import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { sendProviderVerificationEmail } from '../services/emailService';

const prisma = new PrismaClient();

export const setPassword = async (email: string, newPassword: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    return { success: true, message: 'Password updated successfully' };
  } catch (error) {
    console.error('Error setting password:', error);
    throw error;
  }
};

export const createAdminUser = async (
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  phone?: string
) => {
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin user
    const newAdmin = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        role: 'ADMIN',
        isVerified: true,
        isActive: true
      }
    });

    // Return user without password
    const { password: _, ...adminWithoutPassword } = newAdmin;
    return adminWithoutPassword;
  } catch (error) {
    throw error;
  }
};

// Change a user's password (by admin)
export const changeUserPassword = async (
  userId: string,
  newPassword: string,
  adminId: string
) => {
  try {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if admin exists
    const admin = await prisma.user.findUnique({
      where: { 
        id: adminId,
        role: 'ADMIN'
      }
    });

    if (!admin) {
      throw new Error('Admin not found or unauthorized');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update user password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    // Create notification for user
    await prisma.notification.create({
      data: {
        receiverId: userId,
        type: 'GENERAL',
        title: 'Password Changed',
        message: 'Your password has been changed by an administrator. If you did not request this change, please contact support immediately.',
        isRead: false
      }
    });

    return { success: true, message: 'Password changed successfully' };
  } catch (error) {
    throw error;
  }
};

// Get all clients
export const getAllClients = async () => {
  try {
    const clients = await prisma.client.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            profilePicture: true,
            isActive: true,
            isVerified: true,
            createdAt: true
          }
        },
        addresses: true,
        serviceBookings: {
          select: {
            id: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    // Format data to exclude sensitive information
    const formattedClients = clients.map(client => {
      return {
        id: client.id,
        userId: client.userId,
        user: client.user,
        addresses: client.addresses,
        bookingCount: client.serviceBookings.length,
        recentBookings: client.serviceBookings.slice(0, 5)
      };
    });

    return formattedClients;
  } catch (error) {
    throw error;
  }
};

// Get all providers with their services, skills, etc.
export const getAllProviders = async () => {
  try {
    const providers = await prisma.serviceProvider.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            profilePicture: true,
            isActive: true,
            isVerified: true,
            createdAt: true
          }
        },
        services: {
          select: {
            id: true,
            title: true,
            isActive: true
          }
        },
        skills: true,
        documents: {
          select: {
            id: true,
            title: true,
            type: true,
            isVerified: true
          }
        }
      }
    });

    return providers;
  } catch (error) {
    throw error;
  }
};

// Verify a provider's account and ID documents
export const verifyProviderAccount = async (
  providerId: string,
  adminId: string,
  documentId?: string // If verifying a specific document
) => {
  try {
    // Find the provider by ID
    const provider = await prisma.serviceProvider.findUnique({
      where: { id: providerId },
      include: {
        user: true,
        documents: true
      }
    });

    if (!provider) {
      throw new Error('Provider not found');
    }

    // Verify the provider
    const updatedProvider = await prisma.serviceProvider.update({
      where: { id: providerId },
      data: {
        isProviderVerified: true
      },
      include: {
        user: true
      }
    });

    // If a specific document ID was provided, verify just that document
    if (documentId) {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          isVerified: true
        }
      });
    } 
    // Otherwise, verify all ID documents
    else {
      for (const doc of provider.documents) {
        if (doc.type === 'ID') {
          await prisma.document.update({
            where: { id: doc.id },
            data: {
              isVerified: true
            }
          });
        }
      }
    }

    // Create a notification for the provider
    await prisma.notification.create({
      data: {
        receiverId: provider.userId,
        type: 'GENERAL',
        title: 'Account Verified',
        message: 'Your service provider account has been verified by an admin. You can now offer services on the platform.',
        isRead: false
      }
    });

    // Send email notification to the provider
    if (provider.user.email) {
      await sendProviderVerificationEmail(
        provider.user.email,
        provider.user.firstName
      );
    }

    // Excluding sensitive information
    const { user, ...providerData } = updatedProvider;
    const { password, ...userData } = user;

    return {
      ...providerData,
      user: userData
    };
  } catch (error) {
    throw error;
  }
};

// Reject a provider's account verification
export const rejectProviderVerification = async (
  providerId: string,
  adminId: string,
  reason: string
) => {
  try {
    // Find the provider by ID
    const provider = await prisma.serviceProvider.findUnique({
      where: { id: providerId },
      include: {
        user: true
      }
    });

    if (!provider) {
      throw new Error('Provider not found');
    }

    // Create a notification for the provider
    await prisma.notification.create({
      data: {
        receiverId: provider.userId,
        type: 'GENERAL',
        title: 'Verification Rejected',
        message: `Your service provider verification was rejected. Reason: ${reason}. Please update your information and try again.`,
        isRead: false
      }
    });

    // Return the provider (no updates needed as we're just notifying)
    const { user, ...providerData } = provider;
    const { password, ...userData } = user;

    return {
      ...providerData,
      user: userData
    };
  } catch (error) {
    throw error;
  }
};

// Get all unverified providers
export const getUnverifiedProviders = async () => {
  try {
    const providers = await prisma.serviceProvider.findMany({
      where: {
        isProviderVerified: false
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            profilePicture: true,
            createdAt: true
          }
        },
        documents: {
          where: {
            type: 'ID'
          }
        }
      }
    });

    return providers;
  } catch (error) {
    throw error;
  }
};

export const createCategory = async (
  name: string,
  description?: string,
  imageUrl?: string
) => {
  try {
    // Check if category already exists
    const existingCategory = await prisma.category.findUnique({
      where: { name }
    });

    if (existingCategory) {
      throw new Error('Category with this name already exists');
    }

    // Create category
    const newCategory = await prisma.category.create({
      data: {
        name,
        description,
        imageUrl
      }
    });

    return newCategory;
  } catch (error) {
    throw error;
  }
};

// Get all categories
export const getAllCategories = async () => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    return categories;
  } catch (error) {
    throw error;
  }
};

// Edit an existing category
export const editCategory = async (
  categoryId: string,
  updateData: {
    name?: string;
    description?: string;
    imageUrl?: string;
  }
) => {
  try {
    // Check if category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!existingCategory) {
      throw new Error('Category not found');
    }

    // Check if name is being updated and if it's already in use
    if (updateData.name && updateData.name !== existingCategory.name) {
      const categoryWithSameName = await prisma.category.findFirst({
        where: { 
          name: updateData.name,
          id: { not: categoryId } // Exclude the current category
        }
      });

      if (categoryWithSameName) {
        throw new Error('Another category with this name already exists');
      }
    }

    // Update category
    const updatedCategory = await prisma.category.update({
      where: { id: categoryId },
      data: updateData
    });

    return updatedCategory;
  } catch (error) {
    throw error;
  }
};
