import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sendVerificationEmail } from '../services/emailService';
import { createChatConversation } from './allRoleFunctionController';

const prisma = new PrismaClient();

export const registerProvider = async (
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  phone?: string,
  idDocument?: {
    title: string;
    fileUrl: string;
  }
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

    // Generate verification code (6 digits)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 24); // Code valid for 24 hours

    // Create new user with provider profile and verification code
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        role: 'PROVIDER',
        isVerified: false,
        serviceProvider: {
          create: {} // Will use default values, including isProviderVerified: false
        },
        verificationTokens: {
          create: {
            token: verificationCode,
            type: 'EMAIL',
            expiresAt: tokenExpiry
          }
        }
      },
      include: {
        serviceProvider: true,
        verificationTokens: true
      }
    });

    // If ID document is provided, add it
    if (idDocument && newUser.serviceProvider) {
      await prisma.document.create({
        data: {
          serviceProviderId: newUser.serviceProvider.id,
          title: idDocument.title || 'Identity Document',
          type: 'ID',
          fileUrl: idDocument.fileUrl,
          isVerified: false
        }
      });
    }

    // Create verification notification
    await prisma.notification.create({
      data: {
        receiverId: newUser.id,
        type: 'GENERAL',
        title: 'Complete Your Profile for Verification',
        message: 'Your provider account is pending verification. Please complete your profile and upload all necessary identification documents to expedite the verification process.',
        isRead: false
      }
    });

    // Send verification email
    const emailSent = await sendVerificationEmail(
      email,
      verificationCode,
      firstName
    );

    if (!emailSent) {
      console.warn(`Failed to send verification email to ${email}`);
    }

    // Return user without password but with verification code
    const { password: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  } catch (error) {
    throw error;
  }
};

export const updateProviderProfile = async (
  userId: string,
  data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    profilePicture?: string;
    bio?: string;
    headline?: string;
    hourlyRate?: number;
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

    // Prepare data for user update
    const userData = {
      firstName: data.firstName ?? user.firstName,
      lastName: data.lastName ?? user.lastName,
      phone: data.phone ?? user.phone,
      profilePicture: data.profilePicture ?? user.profilePicture
    };

    // Prepare data for provider update
    const providerData = {
      bio: data.bio ?? user.serviceProvider.bio,
      headline: data.headline ?? user.serviceProvider.headline,
      hourlyRate: data.hourlyRate !== undefined ? 
        data.hourlyRate : 
        user.serviceProvider.hourlyRate
    };

    // Update user and provider in a transaction
    const updatedUser = await prisma.$transaction(async (prisma) => {
      // Update user information
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: userData,
        include: {
          serviceProvider: true
        }
      });

      // Update provider information
      await prisma.serviceProvider.update({
        where: { id: user.serviceProvider!.id },
        data: providerData
      });

      return updatedUser;
    });

    // Return user without password
    const { password: _, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  } catch (error) {
    throw error;
  }
};

export const getProviderProfile = async (userId: string) => {
  try {
    // Find user by id with provider data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        serviceProvider: {
          include: {
            workExperience: true,
            education: true,
            skills: true,
            portfolio: true,
            services: {
              include: {
                skills: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.serviceProvider) {
      throw new Error('Provider profile not found');
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } catch (error) {
    throw error;
  }
};

export const addWorkExperience = async (
  userId: string,
  experience: {
    company: string;
    position: string;
    startDate: Date;
    endDate?: Date;
    description?: string;
    isCurrentPosition?: boolean;
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

    // Create new work experience
    const newExperience = await prisma.workExperience.create({
      data: {
        serviceProviderId: user.serviceProvider.id,
        company: experience.company,
        position: experience.position,
        startDate: experience.startDate,
        endDate: experience.endDate,
        description: experience.description,
        isCurrentPosition: experience.isCurrentPosition ?? false
      }
    });

    return newExperience;
  } catch (error) {
    throw error;
  }
};

export const addEducation = async (
  userId: string,
  education: {
    institution: string;
    degree: string;
    fieldOfStudy?: string;
    startDate: Date;
    endDate?: Date;
    isCurrentlyStudying?: boolean;
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

    // Create new education
    const newEducation = await prisma.education.create({
      data: {
        serviceProviderId: user.serviceProvider.id,
        institution: education.institution,
        degree: education.degree,
        fieldOfStudy: education.fieldOfStudy,
        startDate: education.startDate,
        endDate: education.endDate,
        isCurrentlyStudying: education.isCurrentlyStudying ?? false
      }
    });

    return newEducation;
  } catch (error) {
    throw error;
  }
};

export const addSkill = async (userId: string, skillName: string) => {
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

    // Find or create skill
    let skill = await prisma.skill.findFirst({
      where: { name: skillName }
    });

    if (!skill) {
      skill = await prisma.skill.create({
        data: { name: skillName }
      });
    }

    // Add skill to provider if not already added
    const existingSkill = await prisma.skill.findFirst({
      where: {
        name: skillName,
        serviceProviders: {
          some: {
            id: user.serviceProvider.id
          }
        }
      }
    });

    if (existingSkill) {
      throw new Error('Skill already added to provider profile');
    }

    // Connect skill to provider
    await prisma.serviceProvider.update({
      where: { id: user.serviceProvider.id },
      data: {
        skills: {
          connect: { id: skill.id }
        }
      }
    });

    return skill;
  } catch (error) {
    throw error;
  }
};

export const addPortfolio = async (
  userId: string,
  portfolioData: {
    title: string;
    description?: string;
    imageUrls?: string[];
    projectUrl?: string;
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

    // Create portfolio first
    const portfolio = await prisma.portfolio.create({
      data: {
        serviceProviderId: user.serviceProvider.id,
        title: portfolioData.title,
        description: portfolioData.description,
        projectUrl: portfolioData.projectUrl
      }
    });

    // If imageUrls are provided, create portfolio files
    if (portfolioData.imageUrls && portfolioData.imageUrls.length > 0) {
      // Create each file separately
      for (const fileUrl of portfolioData.imageUrls) {
        await prisma.portfolioFile.create({
          data: {
            portfolioId: portfolio.id,
            fileUrl: fileUrl,
            fileName: fileUrl.split('/').pop() || '',
            fileType: getFileTypeFromUrl(fileUrl)
          }
        });
      }
    }

    // Return the portfolio with files
    const portfolioWithFiles = await prisma.portfolio.findUnique({
      where: { id: portfolio.id },
      include: {
        files: true
      }
    });

    return portfolioWithFiles;
  } catch (error) {
    throw error;
  }
};

// Helper function to determine file type from URL
const getFileTypeFromUrl = (url: string): string => {
  const extension = url.split('.').pop()?.toLowerCase() || '';
  
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
    return 'image';
  } else if (['pdf', 'doc', 'docx'].includes(extension)) {
    return 'document';
  } else {
    return 'other';
  }
};

export const createService = async (
  userId: string,
  service: {
    title: string;
    description: string;
    categoryId: string;
    pricing: number;
    pricingType: 'HOURLY' | 'FIXED' | 'DAILY' | 'SESSION';
    imageUrls?: string[];
    skillIds?: string[];
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

    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id: service.categoryId }
    });

    if (!category) {
      throw new Error('Category not found');
    }

    // Create new service
    const newService = await prisma.service.create({
      data: {
        serviceProviderId: user.serviceProvider.id,
        title: service.title,
        description: service.description,
        categoryId: service.categoryId,
        pricing: service.pricing,
        pricingType: service.pricingType,
        imageUrls: service.imageUrls ? JSON.stringify(service.imageUrls) : null,
        isActive: true,
        skills: service.skillIds ? {
          connect: service.skillIds.map(id => ({ id }))
        } : undefined
      },
      include: {
        skills: true,
        category: true
      }
    });

    return newService;
  } catch (error) {
    throw error;
  }
};

export const getCategories = async () => {
  try {
    const categories = await prisma.category.findMany();
    return categories;
  } catch (error) {
    throw error;
  }
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

// Add this new function to create a verification notification for providers
export const createProviderVerificationNotification = async (userId: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { serviceProvider: true }
    });

    if (!user || !user.serviceProvider) {
      throw new Error('Provider not found');
    }

    // Create a notification about verification status
    const notification = await prisma.notification.create({
      data: {
        receiverId: userId,
        type: 'GENERAL',
        title: 'Complete Your Profile for Verification',
        message: 'Your provider account is pending verification. To expedite the verification process, please complete your profile and upload all necessary identification documents.',
        isRead: false
      }
    });

    return notification;
  } catch (error) {
    throw error;
  }
};

// New function to check provider verification status
export const getProviderVerificationStatus = async (userId: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        serviceProvider: {
          include: {
            documents: {
              where: {
                type: 'ID'
              }
            }
          }
        }
      }
    });

    if (!user || !user.serviceProvider) {
      throw new Error('Provider not found');
    }

    return {
      isVerified: user.serviceProvider.isProviderVerified,
      hasUploadedDocuments: user.serviceProvider.documents.length > 0,
      pendingVerification: !user.serviceProvider.isProviderVerified && user.serviceProvider.documents.length > 0
    };
  } catch (error) {
    throw error;
  }
};

export const getProviderBookings = async (
  userId: string,
  status?: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED'
) => {
  try {
    // Find provider by userId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { serviceProvider: true }
    });

    if (!user || !user.serviceProvider) {
      throw new Error('Provider not found');
    }

    // Build query conditions
    const where: any = {
      serviceProviderId: user.serviceProvider.id
    };

    // Filter by status if provided
    if (status) {
      where.status = status;
    }

    // Get all bookings for this provider
    const bookings = await prisma.serviceBooking.findMany({
      where,
      include: {
        service: {
          include: {
            category: true
          }
        },
        client: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePicture: true,
                email: true,
                phone: true
              }
            }
          }
        },
        address: true,
        timeRecords: true
      },
      orderBy: {
        startTime: 'desc'
      }
    });

    return bookings;
  } catch (error) {
    throw error;
  }
};

export const getProviderBookingDetails = async (userId: string, bookingId: string) => {
  try {
    // Find provider by userId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { serviceProvider: true }
    });

    if (!user || !user.serviceProvider) {
      throw new Error('Provider not found');
    }

    // Get booking with details, ensuring it belongs to this provider
    const booking = await prisma.serviceBooking.findFirst({
      where: {
        id: bookingId,
        serviceProviderId: user.serviceProvider.id
      },
      include: {
        service: {
          include: {
            category: true,
            skills: true
          }
        },
        client: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePicture: true,
                email: true,
                phone: true
              }
            }
          }
        },
        address: true,
        payment: true,
        timeRecords: true
      }
    });

    if (!booking) {
      throw new Error('Booking not found or not authorized');
    }

    return booking;
  } catch (error) {
    throw error;
  }
};

export const acceptBooking = async (userId: string, bookingId: string) => {
  try {
    // Find provider by userId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { serviceProvider: true }
    });

    if (!user || !user.serviceProvider) {
      throw new Error('Provider not found');
    }

    // Find the booking and ensure it belongs to this provider
    const booking = await prisma.serviceBooking.findFirst({
      where: {
        id: bookingId,
        serviceProviderId: user.serviceProvider.id
      },
      include: {
        client: {
          include: {
            user: true
          }
        },
        service: true
      }
    });

    if (!booking) {
      throw new Error('Booking not found or not authorized');
    }

    // Ensure booking is in PENDING status
    if (booking.status !== 'PENDING') {
      throw new Error(`Cannot accept a booking with status: ${booking.status}`);
    }

    // Update booking status
    const updatedBooking = await prisma.serviceBooking.update({
      where: { id: bookingId },
      data: { status: 'CONFIRMED' }
    });

    // Create a chat conversation between provider and client
    try {
      await createChatConversation(
        userId,
        booking.client.userId,
        bookingId
      );
    } catch (error) {
      console.error('Error creating chat conversation:', error);
      // Don't fail the booking acceptance if chat creation fails
    }

    // Create notification for client
    await prisma.notification.create({
      data: {
        receiverId: booking.client.userId,
        type: 'BOOKING_CONFIRMED',
        title: 'Booking Confirmed',
        message: `Your booking for "${booking.service.title}" has been confirmed by the provider.`,
        isRead: false,
        data: JSON.stringify({
          bookingId: booking.id,
          serviceId: booking.service.id
        })
      }
    });

    return updatedBooking;
  } catch (error) {
    throw error;
  }
};

export const declineBooking = async (userId: string, bookingId: string, reason?: string) => {
  try {
    // Find provider by userId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { serviceProvider: true }
    });

    if (!user || !user.serviceProvider) {
      throw new Error('Provider not found');
    }

    // Find the booking and ensure it belongs to this provider
    const booking = await prisma.serviceBooking.findFirst({
      where: {
        id: bookingId,
        serviceProviderId: user.serviceProvider.id
      },
      include: {
        client: {
          include: {
            user: true
          }
        },
        service: true
      }
    });

    if (!booking) {
      throw new Error('Booking not found or not authorized');
    }

    // Ensure booking is in PENDING status
    if (booking.status !== 'PENDING') {
      throw new Error(`Cannot decline a booking with status: ${booking.status}`);
    }

    // Update booking status
    const updatedBooking = await prisma.serviceBooking.update({
      where: { id: bookingId },
      data: { 
        status: 'CANCELLED',
        notes: booking.notes ? 
          `${booking.notes}\n\nDeclined by provider${reason ? `: ${reason}` : ''}` : 
          `Declined by provider${reason ? `: ${reason}` : ''}`
      }
    });

    // Create notification for client
    await prisma.notification.create({
      data: {
        receiverId: booking.client.userId,
        type: 'BOOKING_CANCELLED',
        title: 'Booking Declined',
        message: `Your booking for "${booking.service.title}" has been declined by the provider${reason ? `: ${reason}` : ''}.`,
        isRead: false,
        data: JSON.stringify({
          bookingId: booking.id,
          serviceId: booking.service.id
        })
      }
    });

    return updatedBooking;
  } catch (error) {
    throw error;
  }
};

export const startService = async (userId: string, bookingId: string) => {
  try {
    // Find provider by userId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { serviceProvider: true }
    });

    if (!user || !user.serviceProvider) {
      throw new Error('Provider not found');
    }

    // Find the booking and ensure it belongs to this provider
    const booking = await prisma.serviceBooking.findFirst({
      where: {
        id: bookingId,
        serviceProviderId: user.serviceProvider.id
      },
      include: {
        client: {
          include: {
            user: true
          }
        },
        service: true
      }
    });

    if (!booking) {
      throw new Error('Booking not found or not authorized');
    }

    // Ensure booking is in CONFIRMED status
    if (booking.status !== 'CONFIRMED') {
      throw new Error(`Cannot start a booking with status: ${booking.status}`);
    }

    // Update booking status
    const updatedBooking = await prisma.serviceBooking.update({
      where: { id: bookingId },
      data: { status: 'IN_PROGRESS' }
    });

    // Create a time record for the booking
    await prisma.timeRecord.create({
      data: {
        serviceBookingId: bookingId,
        startTime: new Date(),
        // End time will be set when service is completed
      }
    });

    // Create notification for client
    await prisma.notification.create({
      data: {
        receiverId: booking.client.userId,
        type: 'GENERAL',
        title: 'Service Started',
        message: `Your booked service "${booking.service.title}" has been started by the provider.`,
        isRead: false,
        data: JSON.stringify({
          bookingId: booking.id,
          serviceId: booking.service.id
        })
      }
    });

    return updatedBooking;
  } catch (error) {
    throw error;
  }
};

export const completeService = async (userId: string, bookingId: string) => {
  try {
    // Find provider by userId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { serviceProvider: true }
    });

    if (!user || !user.serviceProvider) {
      throw new Error('Provider not found');
    }

    // Find the booking and ensure it belongs to this provider
    const booking = await prisma.serviceBooking.findFirst({
      where: {
        id: bookingId,
        serviceProviderId: user.serviceProvider.id
      },
      include: {
        service: true,
        client: {
          include: {
            user: true
          }
        },
        timeRecords: true
      }
    });

    if (!booking) {
      throw new Error('Booking not found or not authorized');
    }

    // Ensure booking is in IN_PROGRESS status
    if (booking.status !== 'IN_PROGRESS') {
      throw new Error(`Cannot complete a booking with status: ${booking.status}`);
    }

    // Get the active time record (without an end time)
    const activeTimeRecord = booking.timeRecords.find(record => !record.endTime);
    
    if (!activeTimeRecord) {
      throw new Error('No active time record found for this booking');
    }

    // Calculate end time, duration, and total amount
    const endTime = new Date();
    const startTime = new Date(activeTimeRecord.startTime);
    const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60); // in hours
    
    // Calculate total amount based on pricing type
    let totalAmount = booking.service.pricing;
    
    if (booking.service.pricingType === 'HOURLY') {
      // For hourly pricing, multiply by duration
      // Convert the result to a Decimal that Prisma can handle
      const amount = Number(booking.service.pricing) * durationHours;
      totalAmount = new Prisma.Decimal(amount.toString());
    }
    
    // Transaction to update everything at once
    const result = await prisma.$transaction(async (tx) => {
      // Update the time record with end time and duration
      const updatedTimeRecord = await tx.timeRecord.update({
        where: { id: activeTimeRecord.id },
        data: {
          endTime,
          duration: durationHours
        }
      });
      
      // Update the booking with completion details
      const updatedBooking = await tx.serviceBooking.update({
        where: { id: bookingId },
        data: {
          status: 'COMPLETED',
          endTime,
          totalHours: durationHours,
          totalAmount
        }
      });
      
      return {
        booking: updatedBooking,
        timeRecord: updatedTimeRecord
      };
    });
    
    // Create notification for client
    await prisma.notification.create({
      data: {
        receiverId: booking.client.userId,
        type: 'SERVICE_COMPLETED',
        title: 'Service Completed',
        message: `Your booked service "${booking.service.title}" has been completed. Total hours: ${durationHours.toFixed(2)}, Total amount: $${totalAmount.toFixed(2)}.`,
        isRead: false,
        data: JSON.stringify({
          bookingId: booking.id,
          serviceId: booking.service.id,
          totalHours: durationHours,
          totalAmount
        })
      }
    });

    return result.booking;
  } catch (error) {
    throw error;
  }
};
