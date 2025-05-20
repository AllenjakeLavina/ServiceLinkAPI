import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../index';
import express from 'express';
// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Storage configuration for multer
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    // Check if this is a registration request
    if (req.originalUrl.includes('/register')) {
      // For registration, use a temporary folder
      const tempDir = path.join(uploadsDir, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      return cb(null, tempDir);
    }

    // Check if this is an upload-image request for chat
    if (req.originalUrl.includes('/upload-image')) {
      // For chat images, use a chat folder
      const chatDir = path.join(uploadsDir, 'chat');
      if (!fs.existsSync(chatDir)) {
        fs.mkdirSync(chatDir, { recursive: true });
      }
      
      // If user is authenticated, add user subfolder
      const userId = req.user?.id;
      if (userId) {
        const userChatDir = path.join(chatDir, userId);
        if (!fs.existsSync(userChatDir)) {
          fs.mkdirSync(userChatDir, { recursive: true });
        }
        return cb(null, userChatDir);
      }
      
      return cb(null, chatDir);
    }
    
    // Check if this is a category image upload
    if (req.originalUrl.includes('/category/image') || req.originalUrl.includes('/admin/category')) {
      // For category images, use a category folder
      const categoryDir = path.join(uploadsDir, 'category');
      if (!fs.existsSync(categoryDir)) {
        fs.mkdirSync(categoryDir, { recursive: true });
      }
      return cb(null, categoryDir);
    }

    // For authenticated requests, use user-specific folders
    const userId = req.user?.id;
    
    if (!userId) {
      return cb(new Error('User ID not found'), '');
    }
    
    // Create user directory if it doesn't exist
    const userDir = path.join(uploadsDir, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    // Create subdirectory based on file type
    let subDir = 'other';
    
    if (req.originalUrl.includes('/portfolio')) {
      subDir = 'portfolio';
    } else if (req.originalUrl.includes('/document')) {
      subDir = 'documents';
    } else if (req.originalUrl.includes('/profile') || req.originalUrl.includes('/upload-profile-picture')) {
      subDir = 'profile';
    }
    
    const finalDir = path.join(userDir, subDir);
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }
    
    cb(null, finalDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueId = uuidv4();
    const fileExtension = path.extname(file.originalname);
    const safeFilename = `${uniqueId}${fileExtension}`;
    
    cb(null, safeFilename);
  }
});

// File filter to allow only certain file types
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Define allowed file types
  const allowedImageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const allowedDocumentTypes = ['.pdf', '.doc', '.docx', '.txt'];
  
  // Extract file extension
  const ext = path.extname(file.originalname).toLowerCase();
  
  // Check if it's a registration upload (ID document)
  if (req.originalUrl.includes('/register')) {
    // Allow both images and documents for registration
    if ([...allowedImageTypes, ...allowedDocumentTypes].includes(ext)) {
      return cb(null, true);
    }
  }
  // Check if it's a chat image upload
  else if (req.originalUrl.includes('/upload-image')) {
    // Allow only images for chat
    if (allowedImageTypes.includes(ext)) {
      return cb(null, true);
    }
  }
  // Check if it's a category image upload
  else if (req.originalUrl.includes('/category/image') || req.originalUrl.includes('/admin/category')) {
    // Allow only images for categories
    if (allowedImageTypes.includes(ext)) {
      return cb(null, true);
    }
  }
  // Check if it's a portfolio upload
  else if (req.originalUrl.includes('/portfolio')) {
    // Allow images, PDFs, and DOC files for portfolio
    if ([...allowedImageTypes, ...allowedDocumentTypes].includes(ext)) {
      return cb(null, true);
    }
  } 
  // Document uploads (certifications, licenses, etc.)
  else if (req.originalUrl.includes('/document')) {
    // Allow PDFs and DOC files
    if (allowedDocumentTypes.includes(ext)) {
      return cb(null, true);
    }
  } 
  // Profile picture uploads
  else if (req.originalUrl.includes('/profile') || req.originalUrl.includes('/upload-profile-picture')) {
    // Allow only images
    if (allowedImageTypes.includes(ext)) {
      return cb(null, true);
    }
  }
  // Reject file if it doesn't match any allowed types
  cb(null, false);
};

// Configure limits
const limits = {
  fileSize: 300 * 1024 * 1024, // 300MB max file size
};

// Create multer upload middleware
export const uploadFile = multer({
  storage,
  fileFilter,
  limits
});

// Helper to get file URL
export const getFileUrl = (req: Request, file: Express.Multer.File): string => {
  // Check if this is a registration request
  if (req.originalUrl.includes('/register')) {
    // For registration files, use a temp path
    return `/uploads/temp/${file.filename}`;
  }
  
  // Check if this is a chat image upload
  if (req.originalUrl.includes('/upload-image')) {
    const userId = req.user?.id;
    if (userId) {
      return `/uploads/chat/${userId}/${file.filename}`;
    }
    return `/uploads/chat/${file.filename}`;
  }
  
  // Check if this is a category image upload
  if (req.originalUrl.includes('/category/image') || req.originalUrl.includes('/admin/category')) {
    return `/uploads/category/${file.filename}`;
  }

  // For authenticated requests, use user-specific paths
  const userId = req.user?.id;
  
  if (!file || !userId) {
    throw new Error('File or user ID not available');
  }
  
  // Determine subdirectory
  let subDir = 'other';
  
  if (req.originalUrl.includes('/portfolio')) {
    subDir = 'portfolio';
  } else if (req.originalUrl.includes('/document')) {
    subDir = 'documents';
  } else if (req.originalUrl.includes('/profile') || req.originalUrl.includes('/upload-profile-picture')) {
    subDir = 'profile';
  }
  
  // Create relative path (without the base URL)
  return `/uploads/${userId}/${subDir}/${file.filename}`;
};

// Middleware to serve static files
export const configureStaticFileServing = (app: any) => {
  app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));
};

export const addDocument = async (
  userId: string,
  document: {
    title: string;
    type: 'ID' | 'CERTIFICATE' | 'LICENSE' | 'RESUME' | 'OTHER';
    fileUrl: string;
  }
) => {
  try {
    // Find user by id
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { serviceProvider: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.serviceProvider) {
      throw new Error('Provider profile not found');
    }

    // Create new document
    const newDocument = await prisma.document.create({
      data: {
        serviceProviderId: user.serviceProvider.id,
        title: document.title,
        type: document.type,
        fileUrl: document.fileUrl,
        isVerified: false
      }
    });

    return newDocument;
  } catch (error) {
    throw error;
  }
};
