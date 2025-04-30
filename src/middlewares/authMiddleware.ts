import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Interface for decoded token
interface DecodedToken {
  id: string;
  email: string;
  role: string;
  isVerified: boolean;
  clientId?: string;
  providerId?: string;
  providerVerificationStatus?: string;
  iat: number;
  exp: number;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user: DecodedToken;
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Access token is required'
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as DecodedToken;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
    return;
  }
};

export const checkProviderVerification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if user is a provider
    if (req.user.role !== 'PROVIDER') {
      res.status(403).json({
        success: false,
        message: 'Access denied. This endpoint is for service providers only.'
      });
      return;
    }

    // Check provider verification status
    if (req.user.providerVerificationStatus !== 'verified') {
      // Get more detailed status to give better feedback
      const provider = await prisma.serviceProvider.findUnique({
        where: { userId: req.user.id },
        include: {
          documents: {
            where: { type: 'ID' }
          }
        }
      });

      if (!provider) {
        res.status(403).json({
          success: false,
          message: 'Provider profile not found'
        });
        return;
      }

      if (!provider.isProviderVerified) {
        res.status(403).json({
          success: false,
          message: 'Your provider account is pending verification by admin. You will be notified when your account is approved. Please complete your profile and upload all necessary identification documents to expedite the verification process.'
        });
        return;
      }
    }

    next();
  } catch (error) {
    console.error('Verification check error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during verification check'
    });
    return;
  }
};

export const authorizeRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
      return; // Return without value
    }

    const hasRole = roles.includes(req.user.role);
    if (!hasRole) {
      res.status(403).json({ 
        success: false, 
        message: 'Access denied. You do not have permission to access this resource.' 
      });
      return; // Return without value
    }

    next();
  };
};
