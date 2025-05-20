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
            portfolio: {
              include: {
                files: true // Include portfolio files
              }
            },
            documents: true, // Include documents
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

export const getProviderServices = async (userId: string) => {
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

    // Get all services for this provider
    const services = await prisma.service.findMany({
      where: {
        serviceProviderId: user.serviceProvider.id
      },
      include: {
        category: true,
        skills: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return services;
  } catch (error) {
    throw error;
  }
};

export const updateProviderService = async (
  userId: string,
  serviceId: string,
  serviceData: {
    title?: string;
    description?: string;
    categoryId?: string;
    pricing?: number;
    pricingType?: 'HOURLY' | 'FIXED' | 'DAILY' | 'SESSION';
    imageUrls?: string[];
    isActive?: boolean;
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

    // Find the service and ensure it belongs to this provider
    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        serviceProviderId: user.serviceProvider.id
      },
      include: {
        skills: true
      }
    });

    if (!service) {
      throw new Error('Service not found or not authorized');
    }

    // Check if category exists if provided
    if (serviceData.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: serviceData.categoryId }
      });

      if (!category) {
        throw new Error('Category not found');
      }
    }

    // Prepare data for service update
    const updateData: any = {};
    
    if (serviceData.title !== undefined) updateData.title = serviceData.title;
    if (serviceData.description !== undefined) updateData.description = serviceData.description;
    if (serviceData.categoryId !== undefined) updateData.categoryId = serviceData.categoryId;
    if (serviceData.pricing !== undefined) updateData.pricing = serviceData.pricing;
    if (serviceData.pricingType !== undefined) updateData.pricingType = serviceData.pricingType;
    if (serviceData.imageUrls !== undefined) {
      updateData.imageUrls = serviceData.imageUrls ? JSON.stringify(serviceData.imageUrls) : null;
    }
    if (serviceData.isActive !== undefined) updateData.isActive = serviceData.isActive;

    // Update the service
    const updatedService = await prisma.service.update({
      where: { id: serviceId },
      data: updateData,
      include: {
        category: true,
        skills: true
      }
    });

    // Update skills if provided
    if (serviceData.skillIds !== undefined) {
      // First disconnect all existing skills
      await prisma.service.update({
        where: { id: serviceId },
        data: {
          skills: {
            disconnect: service.skills.map(skill => ({ id: skill.id }))
          }
        }
      });

      // Then connect new skills if there are any
      if (serviceData.skillIds.length > 0) {
        await prisma.service.update({
          where: { id: serviceId },
          data: {
            skills: {
              connect: serviceData.skillIds.map(id => ({ id }))
            }
          }
        });
      }

      // Fetch the service again with updated skills
      return await prisma.service.findUnique({
        where: { id: serviceId },
        include: {
          category: true,
          skills: true
        }
      });
    }

    return updatedService;
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
        timeRecords: true,
        payment: true
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
    
    let timeRecordToUpdate;
    
    if (!activeTimeRecord) {
      // Create a new time record if none exists
      console.log('No active time record found, creating one now...');
      
      // Create with start time of 1 hour ago as a fallback
      const defaultStartTime = new Date();
      defaultStartTime.setHours(defaultStartTime.getHours() - 1);
      
      // Create a new time record
      timeRecordToUpdate = await prisma.timeRecord.create({
        data: {
          serviceBookingId: bookingId,
          startTime: defaultStartTime,
        }
      });
      
      console.log('Created new time record:', timeRecordToUpdate);
    } else {
      timeRecordToUpdate = activeTimeRecord;
    }

    // Calculate end time, duration, and total amount
    const endTime = new Date();
    const startTime = new Date(timeRecordToUpdate.startTime);
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
        where: { id: timeRecordToUpdate.id },
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

export const createContract = async (
  userId: string,
  bookingId: string,
  contractData: {
    terms: string;
    paymentAmount: number;
    paymentType: 'HOURLY' | 'FIXED' | 'DAILY' | 'SESSION';
  }
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
        service: true,
        contract: true
      }
    });

    if (!booking) {
      throw new Error('Booking not found or not authorized');
    }

    // Check if contract already exists
    if (booking.contract) {
      throw new Error('Contract already exists for this booking');
    }

    // Create the contract
    const contract = await prisma.contract.create({
      data: {
        serviceBookingId: booking.id,
        terms: contractData.terms,
        paymentAmount: new Prisma.Decimal(contractData.paymentAmount.toString()),
        paymentType: contractData.paymentType,
        providerSigned: true, // Provider signs when creating
        clientSigned: false   // Client will sign later
      }
    });

    // Create notification for client
    await prisma.notification.create({
      data: {
        receiverId: booking.client.user.id,
        type: 'CONTRACT_SIGNED',
        title: 'New Contract Available',
        message: `A contract for service "${booking.service.title}" is available for your review and signature.`,
        isRead: false,
        data: JSON.stringify({
          bookingId: booking.id,
          contractId: contract.id,
          serviceId: booking.service.id
        })
      }
    });

    return contract;
  } catch (error) {
    throw error;
  }
};

export const getContractDetails = async (userId: string, contractId: string) => {
  try {
    // Find user by userId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { 
        serviceProvider: true,
        client: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Find the contract
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        serviceBooking: {
          include: {
            client: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true
                  }
                }
              }
            },
            serviceProvider: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true
                  }
                }
              }
            },
            service: true
          }
        }
      }
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    // Check authorization - only allow involved parties to access
    const isProvider = user.serviceProvider && user.serviceProvider.id === contract.serviceBooking.serviceProviderId;
    const isClient = user.client && user.client.id === contract.serviceBooking.clientId;

    if (!isProvider && !isClient) {
      throw new Error('Not authorized to access this contract');
    }

    return contract;
  } catch (error) {
    throw error;
  }
};

export const updateContract = async (
  userId: string,
  contractId: string,
  contractData: {
    terms?: string;
    paymentAmount?: number;
    paymentType?: 'HOURLY' | 'FIXED' | 'DAILY' | 'SESSION';
  }
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

    // Find the contract
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        serviceBooking: {
          include: {
            client: {
              include: {
                user: true
              }
            }
          }
        }
      }
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    // Check if provider owns this contract
    if (contract.serviceBooking.serviceProviderId !== user.serviceProvider.id) {
      throw new Error('Not authorized to update this contract');
    }

    // Check if client has already signed - can't update after client signs
    if (contract.clientSigned) {
      throw new Error('Cannot update contract after client has signed');
    }

    // Update the contract
    const updatedContract = await prisma.contract.update({
      where: { id: contractId },
      data: {
        terms: contractData.terms ?? contract.terms,
        paymentAmount: contractData.paymentAmount ? 
          new Prisma.Decimal(contractData.paymentAmount.toString()) : 
          contract.paymentAmount,
        paymentType: contractData.paymentType ?? contract.paymentType,
        providerSigned: true, // Re-sign after update
        clientSigned: false   // Reset client signature
      }
    });

    // Notify client of contract update
    await prisma.notification.create({
      data: {
        receiverId: contract.serviceBooking.client.user.id,
        type: 'CONTRACT_SIGNED',
        title: 'Contract Updated',
        message: 'The service contract has been updated. Please review and sign the updated contract.',
        isRead: false,
        data: JSON.stringify({
          contractId: contract.id,
          bookingId: contract.serviceBooking.id
        })
      }
    });

    return updatedContract;
  } catch (error) {
    throw error;
  }
};

export const signContract = async (userId: string, contractId: string) => {
  // Get the user with provider information
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      serviceProvider: true
    }
  });

  if (!user || !user.serviceProvider) {
    throw new Error('User not found or not a service provider');
  }

  // Find the contract
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      serviceBooking: {
        include: {
          client: {
            include: {
              user: true
            }
          },
          service: true
        }
      }
    }
  });

  if (!contract) {
    throw new Error('Contract not found');
  }

  // Check if provider owns this contract
  if (contract.serviceBooking.serviceProviderId !== user.serviceProvider.id) {
    throw new Error('Not authorized to sign this contract');
  }

  // Check if provider has already signed
  if (contract.providerSigned) {
    throw new Error('Contract already signed by provider');
  }

  // Update the contract - mark as signed by provider
  const updatedContract = await prisma.contract.update({
    where: { id: contractId },
    data: {
      providerSigned: true
    },
    include: {
      serviceBooking: {
        include: {
          service: true,
          client: {
            include: {
              user: true
            }
          }
        }
      }
    }
  });

  // Notify the client that provider has signed the contract
  await prisma.notification.create({
    data: {
      receiverId: contract.serviceBooking.client.user.id,
      type: 'CONTRACT_SIGNED',
      title: 'Contract Signed',
      message: `Service provider has signed the contract for service "${contract.serviceBooking.service.title}"`,
      data: JSON.stringify({
        contractId: contract.id,
        bookingId: contract.serviceBookingId
      }),
      isRead: false
    }
  });

  // If both parties have signed, update booking status to confirmed
  if (updatedContract.providerSigned && updatedContract.clientSigned) {
    await prisma.serviceBooking.update({
      where: { id: contract.serviceBookingId },
      data: {
        status: 'CONFIRMED'
      }
    });
  }

  return updatedContract;
};

// Review Functions
export const createClientReview = async (
  userId: string,
  bookingId: string,
  reviewData: {
    rating: number;
    comment?: string;
  }
) => {
  // Get the user with provider information
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      serviceProvider: true
    }
  });

  if (!user || !user.serviceProvider) {
    throw new Error('User not found or not a service provider');
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

  // Check if the booking is completed
  if (booking.status !== 'COMPLETED') {
    throw new Error('Cannot review a booking that is not completed');
  }

  // Check if a review already exists for this booking
  const existingReview = await prisma.review.findFirst({
    where: {
      serviceBookingId: bookingId
    }
  });

  if (existingReview) {
    throw new Error('You have already reviewed this booking');
  }

  // Create a new review
  const review = await prisma.review.create({
    data: {
      rating: reviewData.rating,
      comment: reviewData.comment,
      giverId: user.id,
      receiverId: booking.client.user.id,
      serviceBookingId: bookingId
    }
  });

  // Create notification for the client
  await prisma.notification.create({
    data: {
      receiverId: booking.client.user.id,
      type: 'REVIEW_RECEIVED',
      title: 'New Review Received',
      message: `You received a ${reviewData.rating}-star review from ${user.firstName} ${user.lastName}`,
      data: JSON.stringify({
        bookingId: booking.id,
        serviceId: booking.serviceId,
        reviewId: review.id
      }),
      isRead: false
    }
  });

  return review;
};

export const getReviewsReceived = async (userId: string) => {
  // Get reviews received by the user
  const reviews = await prisma.review.findMany({
    where: {
      receiverId: userId
    },
    include: {
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
  });

  return reviews;
};

export const getReviewsGiven = async (userId: string) => {
  // Get reviews given by the user
  const reviews = await prisma.review.findMany({
    where: {
      giverId: userId
    },
    include: {
      receiver: {
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
  });

  return reviews;
};

export const getServiceProviderReviews = async (providerId: string) => {
  // Get the provider user
  const provider = await prisma.serviceProvider.findUnique({
    where: { id: providerId },
    include: {
      user: true
    }
  });

  if (!provider) {
    throw new Error('Service provider not found');
  }

  // Get all reviews for this provider
  const reviews = await prisma.review.findMany({
    where: {
      receiverId: provider.user.id
    },
    include: {
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
  });

  return {
    provider: {
      id: provider.id,
      userId: provider.userId,
      firstName: provider.user.firstName,
      lastName: provider.user.lastName,
      rating: provider.rating
    },
    reviews: reviews,
    averageRating: provider.rating,
    totalReviews: reviews.length
  };
};

// Availability Functions
export const addAvailabilitySlot = async (
  userId: string,
  availabilityData: {
    dayOfWeek: number; // 0-6 (Sunday-Saturday)
    startTime: string; // Format: "HH:MM" in 24-hour
    endTime: string; // Format: "HH:MM" in 24-hour
    isAvailable?: boolean;
  }
) => {
  // Validate input
  if (availabilityData.dayOfWeek < 0 || availabilityData.dayOfWeek > 6) {
    throw new Error('Day of week must be between 0 (Sunday) and 6 (Saturday)');
  }

  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // 24-hour format: HH:MM
  if (!timeRegex.test(availabilityData.startTime) || !timeRegex.test(availabilityData.endTime)) {
    throw new Error('Time must be in 24-hour format (HH:MM)');
  }

  // Parse times to compare them
  const [startHour, startMinute] = availabilityData.startTime.split(':').map(Number);
  const [endHour, endMinute] = availabilityData.endTime.split(':').map(Number);
  
  // Convert to minutes for easy comparison
  const startTimeMinutes = startHour * 60 + startMinute;
  const endTimeMinutes = endHour * 60 + endMinute;

  if (startTimeMinutes >= endTimeMinutes) {
    throw new Error('End time must be after start time');
  }

  // Find the user with service provider info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { serviceProvider: true }
  });

  if (!user || !user.serviceProvider) {
    throw new Error('Service provider not found');
  }

  // Check for overlapping availability slots
  const existingSlots = await prisma.availability.findMany({
    where: {
      serviceProviderId: user.serviceProvider.id,
      dayOfWeek: availabilityData.dayOfWeek,
      isAvailable: true
    }
  });

  for (const slot of existingSlots) {
    const [slotStartHour, slotStartMinute] = slot.startTime.split(':').map(Number);
    const [slotEndHour, slotEndMinute] = slot.endTime.split(':').map(Number);
    
    const slotStartMinutes = slotStartHour * 60 + slotStartMinute;
    const slotEndMinutes = slotEndHour * 60 + slotEndMinute;

    // Check for overlap
    if (
      (startTimeMinutes >= slotStartMinutes && startTimeMinutes < slotEndMinutes) || // Start time overlaps with existing slot
      (endTimeMinutes > slotStartMinutes && endTimeMinutes <= slotEndMinutes) || // End time overlaps with existing slot
      (startTimeMinutes <= slotStartMinutes && endTimeMinutes >= slotEndMinutes) // New slot completely covers existing slot
    ) {
      throw new Error(`This time slot overlaps with an existing availability slot (${slot.startTime} - ${slot.endTime})`);
    }
  }

  // Create new availability slot
  const availability = await prisma.availability.create({
    data: {
      serviceProviderId: user.serviceProvider.id,
      dayOfWeek: availabilityData.dayOfWeek,
      startTime: availabilityData.startTime,
      endTime: availabilityData.endTime,
      isAvailable: availabilityData.isAvailable !== false // Default to true unless explicitly set to false
    }
  });

  return availability;
};

export const getAvailability = async (userId: string) => {
  // Find the user with service provider info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { serviceProvider: true }
  });

  if (!user || !user.serviceProvider) {
    throw new Error('Service provider not found');
  }

  // Get all availability slots
  const availabilitySlots = await prisma.availability.findMany({
    where: {
      serviceProviderId: user.serviceProvider.id
    },
    orderBy: [
      { dayOfWeek: 'asc' },
      { startTime: 'asc' }
    ]
  });

  // Group by day of week for easier client-side consumption
  const availabilityByDay = [0, 1, 2, 3, 4, 5, 6].map(day => {
    const daySlots = availabilitySlots.filter(slot => slot.dayOfWeek === day);
    return {
      dayOfWeek: day,
      dayName: getDayName(day),
      slots: daySlots
    };
  });

  return {
    providerInfo: {
      id: user.serviceProvider.id,
      userId: user.id,
      name: `${user.firstName} ${user.lastName}`
    },
    availabilityByDay
  };
};

export const updateAvailabilitySlot = async (
  userId: string,
  slotId: string,
  updateData: {
    startTime?: string;
    endTime?: string;
    isAvailable?: boolean;
  }
) => {
  // Find the user with service provider info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { serviceProvider: true }
  });

  if (!user || !user.serviceProvider) {
    throw new Error('Service provider not found');
  }

  // Find the slot and verify it belongs to this provider
  const slot = await prisma.availability.findUnique({
    where: { id: slotId }
  });

  if (!slot) {
    throw new Error('Availability slot not found');
  }

  if (slot.serviceProviderId !== user.serviceProvider.id) {
    throw new Error('You do not have permission to update this availability slot');
  }

  // Validate time formats if provided
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const startTime = updateData.startTime || slot.startTime;
  const endTime = updateData.endTime || slot.endTime;

  if (updateData.startTime && !timeRegex.test(startTime)) {
    throw new Error('Start time must be in 24-hour format (HH:MM)');
  }

  if (updateData.endTime && !timeRegex.test(endTime)) {
    throw new Error('End time must be in 24-hour format (HH:MM)');
  }

  // Parse and compare times to ensure end is after start
  if (updateData.startTime || updateData.endTime) {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = endHour * 60 + endMinute;

    if (startTimeMinutes >= endTimeMinutes) {
      throw new Error('End time must be after start time');
    }

    // Check for overlapping availability slots (excluding this slot)
    if (updateData.startTime || updateData.endTime) {
      const existingSlots = await prisma.availability.findMany({
        where: {
          serviceProviderId: user.serviceProvider.id,
          dayOfWeek: slot.dayOfWeek,
          isAvailable: true,
          id: { not: slotId }
        }
      });

      for (const existingSlot of existingSlots) {
        const [slotStartHour, slotStartMinute] = existingSlot.startTime.split(':').map(Number);
        const [slotEndHour, slotEndMinute] = existingSlot.endTime.split(':').map(Number);
        
        const slotStartMinutes = slotStartHour * 60 + slotStartMinute;
        const slotEndMinutes = slotEndHour * 60 + slotEndMinute;

        // Check for overlap
        if (
          (startTimeMinutes >= slotStartMinutes && startTimeMinutes < slotEndMinutes) ||
          (endTimeMinutes > slotStartMinutes && endTimeMinutes <= slotEndMinutes) ||
          (startTimeMinutes <= slotStartMinutes && endTimeMinutes >= slotEndMinutes)
        ) {
          throw new Error(`This time slot would overlap with an existing availability slot (${existingSlot.startTime} - ${existingSlot.endTime})`);
        }
      }
    }
  }

  // Update the slot
  const updatedSlot = await prisma.availability.update({
    where: { id: slotId },
    data: {
      startTime: updateData.startTime,
      endTime: updateData.endTime,
      isAvailable: updateData.isAvailable
    }
  });

  return updatedSlot;
};

export const deleteAvailabilitySlot = async (userId: string, slotId: string) => {
  // Find the user with service provider info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { serviceProvider: true }
  });

  if (!user || !user.serviceProvider) {
    throw new Error('Service provider not found');
  }

  // Find the slot and verify it belongs to this provider
  const slot = await prisma.availability.findUnique({
    where: { id: slotId }
  });

  if (!slot) {
    throw new Error('Availability slot not found');
  }

  if (slot.serviceProviderId !== user.serviceProvider.id) {
    throw new Error('You do not have permission to delete this availability slot');
  }

  // Check for any bookings that might depend on this availability slot
  // This is a simplification. In a production system, you'd want to check
  // if any bookings exist in this time slot on any day that matches this day of week.
  // For simplicity, we're skipping this check here.

  // Delete the slot
  await prisma.availability.delete({
    where: { id: slotId }
  });

  return { success: true, message: 'Availability slot deleted successfully' };
};

// Helper function to get day name
const getDayName = (dayOfWeek: number): string => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek];
};
