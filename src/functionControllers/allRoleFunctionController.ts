import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { sendVerificationEmail } from '../services/emailService';
const prisma = new PrismaClient();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  }
});

export const loginUser = async (email: string, password: string) => {
  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        client: true,
        serviceProvider: true
      }
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is inactive. Please contact support.');
    }
    
    // Check if email is verified
    if (!user.isVerified) {
      throw new Error('Email not verified. Please verify your email before logging in.');
    }
    
    // Provider verification check - store status but don't prevent login
    let providerVerificationStatus = null;
    if (user.role === 'PROVIDER' && user.serviceProvider) {
      providerVerificationStatus = user.serviceProvider.isProviderVerified ? 'verified' : 'pending';
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        clientId: user.client?.id,
        providerId: user.serviceProvider?.id,
        providerVerificationStatus // Include verification status in token
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );

    // Return user information (excluding password) and token
    const { password: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      token,
      providerVerificationStatus
    };
  } catch (error) {
    throw error;
  }
};

export const changePassword = async (userId: string, currentPassword: string, newPassword: string) => {
  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    return { success: true, message: 'Password changed successfully' };
  } catch (error) {
    throw error;
  }
};

export const getUserById = async (userId: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        client: {
          include: {
            addresses: true
          }
        },
        serviceProvider: {
          include: {
            services: true,
            portfolio: true,
            workExperience: true,
            education: true,
            skills: true
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } catch (error) {
    throw error;
  }
};

export const forgotPassword = async (email: string) => {
  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Generate a simple 6-digit verification code instead of a complex token
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 1); // Code valid for 1 hour

    // Store the actual 6-digit code in the database
    await prisma.resetPasswordToken.create({
      data: {
        userId: user.id,
        token: resetCode, // Store the simple code directly
        expiresAt: tokenExpiry
      }
    });

    // Send reset email with the same code
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hello ${user.firstName},</p>
        <p>We received a request to reset your password. Use the code below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="background-color: #f4f4f4; padding: 15px; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
            ${resetCode}
          </div>
        </div>
        <p>This code will expire in 1 hour.</p>
        <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
        <p>Thanks,<br>The ServiceLink Team</p>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Reset Your Password',
      html: emailContent
    };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true, message: 'Password reset instructions sent to your email' };
    } catch (error) {
      console.error('Error sending reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  } catch (error) {
    throw error;
  }
};

export const resetPassword = async (email: string, token: string, newPassword: string) => {
  try {
    // Find user by email with all their unexpired reset tokens
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        resetPasswordTokens: {
          where: {
            isUsed: false,
            expiresAt: { gt: new Date() } // Only tokens that aren't expired
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.resetPasswordTokens.length === 0) {
      throw new Error('No valid reset tokens found');
    }

    // Find a token where the first 6 characters match the provided token
    const upperToken = token.toUpperCase();
    const matchingToken = user.resetPasswordTokens.find(
      resetToken => resetToken.token.substring(0, 6).toUpperCase() === upperToken
    );

    if (!matchingToken) {
      throw new Error('Invalid or expired reset token');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      }),
      prisma.resetPasswordToken.update({
        where: { id: matchingToken.id },
        data: { isUsed: true }
      })
    ]);

    return { success: true, message: 'Password reset successfully' };
  } catch (error) {
    throw error;
  }
};


export const resendVerificationCode = async (email: string) => {
    try {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          verificationTokens: {
            where: {
              type: 'EMAIL',
              isUsed: false
            },
            orderBy: {
              createdAt: 'desc'
            },
            take: 1
          }
        }
      });
  
      if (!user) {
        throw new Error('User not found');
      }
  
      if (user.isVerified) {
        throw new Error('User is already verified');
      }
  
      // Generate new verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const tokenExpiry = new Date();
      tokenExpiry.setHours(tokenExpiry.getHours() + 24); // Code valid for 24 hours
  
      // Create new verification code
      const newToken = await prisma.verificationToken.create({
        data: {
          userId: user.id,
          token: verificationCode,
          type: 'EMAIL',
          expiresAt: tokenExpiry
        }
      });
  
      // Send verification email
      const emailSent = await sendVerificationEmail(
        email,
        verificationCode,
        user.firstName
      );
  
      if (!emailSent) {
        console.warn(`Failed to resend verification email to ${email}`);
        throw new Error('Failed to send verification email');
      }
  
      return { success: true, message: 'Verification email resent successfully' };
    } catch (error) {
      throw error;
    }
  };
  
  export const verifyEmailCode = async (email: string, code: string) => {
    try {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          verificationTokens: {
            where: {
              type: 'EMAIL',
              isUsed: false,
              token: code
            },
            orderBy: {
              createdAt: 'desc'
            },
            take: 1
          }
        }
      });
  
      if (!user) {
        throw new Error('User not found');
      }
  
      if (user.isVerified) {
        throw new Error('User is already verified');
      }
  
      if (user.verificationTokens.length === 0) {
        throw new Error('Invalid or expired verification code');
      }
  
      const token = user.verificationTokens[0];
      
      // Check if token is expired
      if (new Date() > token.expiresAt) {
        throw new Error('Verification code has expired');
      }
  
      // Mark token as used
      await prisma.verificationToken.update({
        where: { id: token.id },
        data: { isUsed: true }
      });
  
      // Mark user as verified
      await prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true }
      });
  
      return { success: true, message: 'Email verified successfully' };
    } catch (error) {
      throw error;
    }
  };

export const getAllServices = async (
  filters?: {
    categoryId?: string;
    minPrice?: number;
    maxPrice?: number;
    searchTerm?: string;
    skillIds?: string[];
  },
  pagination?: {
    page?: number;
    limit?: number;
  }
) => {
  try {
    // Set default pagination values
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const skip = (page - 1) * limit;

    // Build where conditions based on filters
    const where: any = {
      isActive: true
    };

    // Filter by category if provided
    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    // Filter by price range if provided
    if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
      where.pricing = {};
      if (filters.minPrice !== undefined) {
        where.pricing.gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        where.pricing.lte = filters.maxPrice;
      }
    }

    // Search in title or description
    if (filters?.searchTerm) {
      where.OR = [
        { title: { contains: filters.searchTerm } },
        { description: { contains: filters.searchTerm } }
      ];
    }

    // Only include services where provider is verified
    where.serviceProvider = {
      isProviderVerified: true
    };

    // Filter by skills if provided
    let skillFilter = undefined;
    if (filters?.skillIds && filters.skillIds.length > 0) {
      skillFilter = {
        some: {
          id: {
            in: filters.skillIds
          }
        }
      };
    }

    // Get services with provider details, category and ratings
    const services = await prisma.service.findMany({
      where,
      include: {
        category: true,
        skills: true,
        serviceProvider: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePicture: true,
                receivedReviews: {
                  select: {
                    id: true,
                    rating: true,
                    comment: true,
                    createdAt: true,
                    giver: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        profilePicture: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });

    // Get total count for pagination
    const total = await prisma.service.count({ where });

    // Process services to calculate average rating and format response
    const processedServices = services.map(service => {
      const reviews = service.serviceProvider.user.receivedReviews;
      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = reviews.length > 0 ? totalRating / reviews.length : null;
      const reviewCount = reviews.length;

      // Process image URLs (stored as JSON string)
      let imageUrls: string[] = [];
      if (service.imageUrls) {
        try {
          imageUrls = JSON.parse(service.imageUrls);
        } catch (error) {
          console.warn(`Error parsing image URLs for service ${service.id}:`, error);
        }
      }

      return {
        id: service.id,
        title: service.title,
        description: service.description,
        pricing: service.pricing,
        pricingType: service.pricingType,
        imageUrls,
        category: service.category,
        skills: service.skills,
        provider: {
          id: service.serviceProvider.id,
          userId: service.serviceProvider.userId,
          name: `${service.serviceProvider.user.firstName} ${service.serviceProvider.user.lastName}`,
          profilePicture: service.serviceProvider.user.profilePicture,
          rating: averageRating,
          reviewCount
        },
        createdAt: service.createdAt,
        updatedAt: service.updatedAt
      };
    });

    return {
      services: processedServices,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    throw error;
  }
};

export const getServiceDetails = async (serviceId: string) => {
  try {
    const service = await prisma.service.findUnique({
      where: {
        id: serviceId,
        isActive: true
      },
      include: {
        category: true,
        skills: true,
        serviceProvider: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePicture: true,
                receivedReviews: {
                  select: {
                    id: true,
                    rating: true,
                    comment: true,
                    createdAt: true,
                    giver: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        profilePicture: true
                      }
                    }
                  }
                }
              }
            },
            portfolio: {
              take: 5,
              orderBy: {
                createdAt: 'desc'
              },
              include: {
                files: true
              }
            },
            workExperience: true,
            education: true
          }
        }
      }
    });

    if (!service) {
      throw new Error('Service not found');
    }

    // Check if provider is verified
    if (!service.serviceProvider.isProviderVerified) {
      throw new Error('This service is not available because the provider is not verified');
    }

    // Calculate average rating from reviews
    const reviews = service.serviceProvider.user.receivedReviews;
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = reviews.length > 0 ? totalRating / reviews.length : null;
    const reviewCount = reviews.length;

    // Process image URLs (stored as JSON string)
    let imageUrls: string[] = [];
    if (service.imageUrls) {
      try {
        imageUrls = JSON.parse(service.imageUrls);
      } catch (error) {
        console.warn(`Error parsing image URLs for service ${service.id}:`, error);
      }
    }

    // Process portfolio with files
    const portfolio = service.serviceProvider.portfolio.map(item => {
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        projectUrl: item.projectUrl,
        createdAt: item.createdAt,
        files: item.files?.map(file => ({
          id: file.id,
          fileUrl: file.fileUrl,
          fileName: file.fileName,
          fileType: file.fileType
        })) || []
      };
    });

    return {
      id: service.id,
      title: service.title,
      description: service.description,
      pricing: service.pricing,
      pricingType: service.pricingType,
      imageUrls,
      category: service.category,
      skills: service.skills,
      provider: {
        id: service.serviceProvider.id,
        userId: service.serviceProvider.userId,
        name: `${service.serviceProvider.user.firstName} ${service.serviceProvider.user.lastName}`,
        profilePicture: service.serviceProvider.user.profilePicture,
        bio: service.serviceProvider.bio,
        portfolio,
        workExperience: service.serviceProvider.workExperience,
        education: service.serviceProvider.education,
        rating: averageRating,
        reviewCount,
        reviews
      },
      createdAt: service.createdAt,
      updatedAt: service.updatedAt
    };
  } catch (error) {
    throw error;
  }
};

export const searchProviders = async (
  query?: {
    searchTerm?: string;
    skillIds?: string[];
    categoryId?: string;
  },
  pagination?: {
    page?: number;
    limit?: number;
  }
) => {
  try {
    // Set default pagination values
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const skip = (page - 1) * limit;

    // Build where conditions
    const where: any = {
      isProviderVerified: true,
      user: {
        isActive: true,
        isVerified: true
      }
    };

    // Search by name
    if (query?.searchTerm) {
      where.user.OR = [
        { firstName: { contains: query.searchTerm } },
        { lastName: { contains: query.searchTerm } }
      ];
    }

    // Filter by skills
    if (query?.skillIds && query.skillIds.length > 0) {
      where.skills = {
        some: {
          id: {
            in: query.skillIds
          }
        }
      };
    }

    // Filter by category (via services)
    if (query?.categoryId) {
      where.services = {
        some: {
          categoryId: query.categoryId
        }
      };
    }

    // Get providers
    const providers = await prisma.serviceProvider.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
            receivedReviews: {
              select: {
                id: true,
                rating: true
              }
            }
          }
        },
        skills: true,
        services: {
          include: {
            category: true
          }
        }
      },
      skip,
      take: limit
    });

    // Get total count for pagination
    const total = await prisma.serviceProvider.count({ where });

    // Process providers to include ratings
    const processedProviders = providers.map(provider => {
      const reviews = provider.user.receivedReviews;
      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = reviews.length > 0 ? totalRating / reviews.length : null;
      const reviewCount = reviews.length;

      return {
        id: provider.id,
        userId: provider.userId,
        name: `${provider.user.firstName} ${provider.user.lastName}`,
        profilePicture: provider.user.profilePicture,
        headline: provider.headline,
        bio: provider.bio,
        hourlyRate: provider.hourlyRate,
        skills: provider.skills,
        services: provider.services.map(service => ({
          id: service.id,
          title: service.title,
          categoryName: service.category.name
        })),
        rating: averageRating,
        reviewCount
      };
    });

    return {
      providers: processedProviders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    throw error;
  }
};

export const getProviderDetails = async (providerId: string) => {
  try {
    const provider = await prisma.serviceProvider.findUnique({
      where: {
        id: providerId,
        isProviderVerified: true
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
            phone: true,
            email: true,
            receivedReviews: {
              select: {
                id: true,
                rating: true,
                comment: true,
                createdAt: true,
                giver: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    profilePicture: true
                  }
                }
              },
              orderBy: {
                createdAt: 'desc'
              }
            }
          }
        },
        skills: true,
        portfolio: {
          take: 5,
          orderBy: {
            createdAt: 'desc'
          },
          include: {
            files: true
          }
        },
        workExperience: {
          orderBy: {
            startDate: 'desc'
          }
        },
        education: {
          orderBy: {
            startDate: 'desc'
          }
        },
        services: {
          where: {
            isActive: true
          },
          include: {
            category: true,
            skills: true
          }
        }
      }
    });

    if (!provider) {
      throw new Error('Provider not found or not verified');
    }

    // Calculate average rating from reviews
    const reviews = provider.user.receivedReviews;
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = reviews.length > 0 ? totalRating / reviews.length : null;
    const reviewCount = reviews.length;

    // Process portfolio with files
    const portfolio = provider.portfolio.map(item => {
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        projectUrl: item.projectUrl,
        createdAt: item.createdAt,
        files: item.files?.map(file => ({
          id: file.id,
          fileUrl: file.fileUrl,
          fileName: file.fileName,
          fileType: file.fileType
        })) || []
      };
    });

    // Process service image URLs
    const services = provider.services.map(service => {
      let imageUrls: string[] = [];
      if (service.imageUrls) {
        try {
          imageUrls = JSON.parse(service.imageUrls);
        } catch (error) {
          console.warn(`Error parsing image URLs for service ${service.id}:`, error);
        }
      }

      return {
        ...service,
        imageUrls
      };
    });

    return {
      id: provider.id,
      userId: provider.userId,
      firstName: provider.user.firstName,
      lastName: provider.user.lastName,
      fullName: `${provider.user.firstName} ${provider.user.lastName}`,
      profilePicture: provider.user.profilePicture,
      phone: provider.user.phone,
      email: provider.user.email,
      headline: provider.headline,
      bio: provider.bio,
      hourlyRate: provider.hourlyRate,
      skills: provider.skills,
      portfolio,
      workExperience: provider.workExperience,
      education: provider.education,
      services,
      rating: averageRating,
      reviewCount,
      reviews: provider.user.receivedReviews
    };
  } catch (error) {
    throw error;
  }
};

export const createChatConversation = async (
  user1Id: string,
  user2Id: string,
  serviceBookingId?: string
) => {
  try {
    // Check if a conversation already exists between these users
    const existingConversation = await prisma.$queryRaw`
      SELECT id FROM Conversation 
      WHERE (user1Id = ${user1Id} AND user2Id = ${user2Id})
      OR (user1Id = ${user2Id} AND user2Id = ${user1Id})
      LIMIT 1
    `;

    if (existingConversation && (existingConversation as any[])[0]) {
      const conversationId = (existingConversation as any[])[0].id;
      
      // If conversation already exists, update it with the new booking if provided
      if (serviceBookingId) {
        await prisma.$executeRaw`
          UPDATE Conversation 
          SET serviceBookingId = ${serviceBookingId}
          WHERE id = ${conversationId}
        `;
      }
      
      return { id: conversationId };
    }

    // Create a new conversation
    const result = await prisma.$executeRaw`
      INSERT INTO Conversation (id, user1Id, user2Id, serviceBookingId, createdAt, updatedAt)
      VALUES (UUID(), ${user1Id}, ${user2Id}, ${serviceBookingId || null}, NOW(), NOW())
    `;
    
    // Get the created conversation
    const newConversation = await prisma.$queryRaw`
      SELECT id FROM Conversation 
      WHERE user1Id = ${user1Id} AND user2Id = ${user2Id}
      ORDER BY createdAt DESC
      LIMIT 1
    `;
    
    return { id: (newConversation as any[])[0]?.id };
  } catch (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }
};

export const getUserConversations = async (userId: string) => {
  try {
    // Get all conversations where the user is either user1 or user2
    const conversations = await prisma.$queryRaw`
      SELECT 
        c.id, c.serviceBookingId, c.createdAt, c.updatedAt,
        u1.id as user1Id, u1.firstName as user1FirstName, u1.lastName as user1LastName, u1.profilePicture as user1ProfilePic,
        u2.id as user2Id, u2.firstName as user2FirstName, u2.lastName as user2LastName, u2.profilePicture as user2ProfilePic,
        (SELECT content FROM Message WHERE conversationId = c.id ORDER BY createdAt DESC LIMIT 1) as lastMessage,
        (SELECT imageUrl FROM Message WHERE conversationId = c.id ORDER BY createdAt DESC LIMIT 1) as lastMessageImageUrl,
        (SELECT createdAt FROM Message WHERE conversationId = c.id ORDER BY createdAt DESC LIMIT 1) as lastMessageTime,
        (SELECT COUNT(*) FROM Message WHERE conversationId = c.id AND isRead = false AND senderId != ${userId}) as unreadCount,
        sb.title as bookingTitle, sb.status as bookingStatus
      FROM Conversation c
      JOIN User u1 ON c.user1Id = u1.id
      JOIN User u2 ON c.user2Id = u2.id
      LEFT JOIN ServiceBooking sb ON c.serviceBookingId = sb.id
      WHERE c.user1Id = ${userId} OR c.user2Id = ${userId}
      ORDER BY lastMessageTime DESC
    `;

    // Process the conversations to include user details
    const processedConversations = (conversations as any[]).map(conv => {
      const otherUser = conv.user1Id === userId ? 
        {
          id: conv.user2Id,
          firstName: conv.user2FirstName,
          lastName: conv.user2LastName,
          profilePicture: conv.user2ProfilePic
        } : 
        {
          id: conv.user1Id,
          firstName: conv.user1FirstName,
          lastName: conv.user1LastName,
          profilePicture: conv.user1ProfilePic
        };

      // Determine if conversation is active based on booking status
      const isActive = !conv.serviceBookingId || conv.bookingStatus !== 'COMPLETED';

      return {
        id: conv.id,
        otherUser,
        lastMessage: conv.lastMessage,
        lastMessageImageUrl: conv.lastMessageImageUrl,
        lastMessageTime: conv.lastMessageTime,
        unreadCount: Number(conv.unreadCount),
        booking: conv.serviceBookingId ? {
          id: conv.serviceBookingId,
          title: conv.bookingTitle,
          status: conv.bookingStatus
        } : null,
        isActive: isActive,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      };
    });

    return processedConversations;
  } catch (error) {
    console.error('Error getting user conversations:', error);
    throw error;
  }
};

export const getConversationMessages = async (conversationId: string, userId: string) => {
  try {
    // Verify the user is part of this conversation
    const conversation = await prisma.$queryRaw`
      SELECT c.id, c.serviceBookingId, sb.status as bookingStatus 
      FROM Conversation c
      LEFT JOIN ServiceBooking sb ON c.serviceBookingId = sb.id
      WHERE c.id = ${conversationId} 
      AND (c.user1Id = ${userId} OR c.user2Id = ${userId})
    `;

    const conv = (conversation as any[])[0];
    if (!conv) {
      throw new Error('Conversation not found or access denied');
    }
    
    // Add booking status to the response
    const isBookingCompleted = conv.bookingStatus === 'COMPLETED';

    // Get messages for this conversation
    const messages = await prisma.$queryRaw`
      SELECT 
        m.id, m.content, m.imageUrl, m.createdAt, m.isRead,
        m.senderId, u.firstName as senderFirstName, u.lastName as senderLastName, 
        u.profilePicture as senderProfilePic
      FROM Message m
      JOIN User u ON m.senderId = u.id
      WHERE m.conversationId = ${conversationId}
      ORDER BY m.createdAt ASC
    `;

    // Mark messages as read if they were sent to this user
    await prisma.$executeRaw`
      UPDATE Message 
      SET isRead = true 
      WHERE conversationId = ${conversationId} 
      AND receiverId = ${userId}
      AND isRead = false
    `;

    // Add system message if booking is completed
    let processedMessages = (messages as any[]).map(msg => ({
      id: msg.id,
      content: msg.content,
      imageUrl: msg.imageUrl,
      createdAt: msg.createdAt,
      isRead: Boolean(msg.isRead),
      sender: {
        id: msg.senderId,
        firstName: msg.senderFirstName,
        lastName: msg.senderLastName,
        profilePicture: msg.senderProfilePic
      }
    }));
    
    // Return messages with booking status
    return {
      messages: processedMessages,
      conversationStatus: {
        isActive: !isBookingCompleted,
        serviceBookingId: conv.serviceBookingId,
        bookingStatus: conv.bookingStatus
      }
    };
  } catch (error) {
    console.error('Error getting conversation messages:', error);
    throw error;
  }
};

export const sendMessage = async (
  conversationId: string, 
  senderId: string, 
  content: string,
  imageUrl?: string
) => {
  try {
    // Verify the conversation exists and user is part of it, and check booking status
    const conversation = await prisma.$queryRaw`
      SELECT c.user1Id, c.user2Id, c.serviceBookingId, sb.status as bookingStatus
      FROM Conversation c
      LEFT JOIN ServiceBooking sb ON c.serviceBookingId = sb.id
      WHERE c.id = ${conversationId} 
      AND (c.user1Id = ${senderId} OR c.user2Id = ${senderId})
    `;

    const conv = (conversation as any[])[0];
    if (!conv) {
      throw new Error('Conversation not found or access denied');
    }

    // Check if the booking is completed - if so, prevent sending messages
    if (conv.serviceBookingId && conv.bookingStatus === 'COMPLETED') {
      throw new Error('This conversation is closed because the service booking has been completed');
    }

    // Determine the receiver (the other user in the conversation)
    const receiverId = conv.user1Id === senderId ? conv.user2Id : conv.user1Id;

    // Insert the message with optional image URL
    await prisma.$executeRaw`
      INSERT INTO Message (id, conversationId, senderId, receiverId, content, imageUrl, createdAt, isRead)
      VALUES (UUID(), ${conversationId}, ${senderId}, ${receiverId}, ${content}, ${imageUrl || null}, NOW(), false)
    `;

    // Get the inserted message with sender details
    const newMessage = await prisma.$queryRaw`
      SELECT 
        m.id, m.content, m.imageUrl, m.createdAt, m.isRead,
        m.senderId, u.firstName as senderFirstName, u.lastName as senderLastName, 
        u.profilePicture as senderProfilePic
      FROM Message m
      JOIN User u ON m.senderId = u.id
      WHERE m.conversationId = ${conversationId}
      AND m.senderId = ${senderId}
      ORDER BY m.createdAt DESC
      LIMIT 1
    `;

    const msg = (newMessage as any[])[0];
    return {
      id: msg.id,
      content: msg.content,
      imageUrl: msg.imageUrl,
      createdAt: msg.createdAt,
      isRead: Boolean(msg.isRead),
      sender: {
        id: msg.senderId,
        firstName: msg.senderFirstName,
        lastName: msg.senderLastName,
        profilePicture: msg.senderProfilePic
      }
    };
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

export const getUserNotifications = async (userId: string, page: number = 1, limit: number = 10) => {
  try {
    console.log(`Getting notifications for user ID: ${userId}, page: ${page}, limit: ${limit}`);
    const offset = (page - 1) * limit;
    
    // First, let's check if the user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      console.error(`User with ID ${userId} not found`);
      throw new Error('User not found');
    }
    
    // Get notifications for this user with pagination
    const notifications = await prisma.notification.findMany({
      where: {
        receiverId: userId
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: offset,
      take: limit + 1 // Take one extra to check if there are more
    });

    console.log(`Found ${notifications.length} notifications before hasMore check`);
    
    // Check if there are more notifications
    const hasMore = notifications.length > limit;
    const notificationsToReturn = hasMore ? notifications.slice(0, limit) : notifications;
    
    console.log(`Returning ${notificationsToReturn.length} notifications, hasMore: ${hasMore}`);

    // Get total count
    const totalCount = await prisma.notification.count({
      where: {
        receiverId: userId
      }
    });
    
    console.log(`Total notification count for user: ${totalCount}`);

    return {
      notifications: notificationsToReturn,
      hasMore,
      totalCount,
      page,
      limit
    };
  } catch (error) {
    console.error('Error getting notifications:', error);
    throw error;
  }
};

export const getUnreadNotificationCount = async (userId: string) => {
  try {
    console.log(`Counting unread notifications for user ID: ${userId}`);
    
    // First, let's check if the user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      console.warn(`User with ID ${userId} not found, returning 0 notifications`);
      return 0; // Return 0 instead of throwing an error
    }
    
    // Let's check the total number of notifications in the system for debugging
    const totalNotifications = await prisma.notification.count();
    console.log(`Total notifications in system: ${totalNotifications}`);
    
    // Let's check all notifications for this user
    const userNotifications = await prisma.notification.count({
      where: {
        receiverId: userId
      }
    });
    console.log(`Total notifications for user: ${userNotifications}`);
    
    // Now get the unread count with explicit filtering
    const count = await prisma.notification.count({
      where: {
        receiverId: userId,
        isRead: false
      }
    });
    
    console.log(`Unread notifications for user: ${count}`);
    
    return count;
  } catch (error) {
    console.error('Error counting unread notifications:', error);
    throw error;
  }
};

export const markNotificationAsRead = async (userId: string, notificationId: string) => {
  try {
    // Verify the notification belongs to this user
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        receiverId: userId
      }
    });

    if (!notification) {
      throw new Error('Notification not found or does not belong to this user');
    }

    // Mark notification as read
    const updatedNotification = await prisma.notification.update({
      where: {
        id: notificationId
      },
      data: {
        isRead: true
      }
    });

    return updatedNotification;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

export const markAllNotificationsAsRead = async (userId: string) => {
  try {
    // Mark all notifications for this user as read
    const result = await prisma.notification.updateMany({
      where: {
        receiverId: userId,
        isRead: false
      },
      data: {
        isRead: true
      }
    });

    return {
      count: result.count
    };
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

export const updateProfilePicture = async (userId: string, profilePictureUrl: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Update user's profile picture
    await prisma.user.update({
      where: { id: userId },
      data: { profilePicture: profilePictureUrl }
    });

    return { success: true, message: 'Profile picture updated successfully' };
  } catch (error) {
    throw error;
  }
};

export const getCategoriesWithServices = async () => {
  try {
    // Get all categories
    const categories = await prisma.category.findMany({
      include: {
        services: {
          where: {
            isActive: true,
            serviceProvider: {
              isProviderVerified: true
            }
          },
          include: {
            category: true,
            skills: true,
            serviceProvider: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    profilePicture: true,
                    receivedReviews: {
                      select: {
                        rating: true
                      }
                    }
                  }
                }
              }
            }
          },
          take: 5 // Limit to 5 services per category for the overview
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Process the categories and their services
    const processedCategories = categories.map(category => {
      // Process services for each category
      const processedServices = category.services.map(service => {
        // Calculate average rating
        const reviews = service.serviceProvider.user.receivedReviews;
        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = reviews.length > 0 ? totalRating / reviews.length : null;
        const reviewCount = reviews.length;

        // Parse image URLs
        let imageUrls: string[] = [];
        if (service.imageUrls) {
          try {
            imageUrls = JSON.parse(service.imageUrls);
          } catch (error) {
            console.warn(`Error parsing image URLs for service ${service.id}:`, error);
          }
        }

        return {
          id: service.id,
          title: service.title,
          description: service.description,
          pricing: service.pricing,
          pricingType: service.pricingType,
          imageUrls,
          skills: service.skills,
          provider: {
            id: service.serviceProvider.id,
            name: `${service.serviceProvider.user.firstName} ${service.serviceProvider.user.lastName}`,
            profilePicture: service.serviceProvider.user.profilePicture,
            rating: averageRating,
            reviewCount
          }
        };
      });

      // Ensure the imageUrl is included in the returned category
      return {
        id: category.id,
        name: category.name,
        description: category.description,
        imageUrl: category.imageUrl || null, // Ensure even null is returned explicitly
        serviceCount: category.services.length,
        services: processedServices
      };
    });

    return processedCategories;
  } catch (error) {
    throw error;
  }
};