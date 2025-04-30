import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sendVerificationEmail } from '../services/emailService';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

// Create email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

// Send booking notification email to provider
const sendBookingNotificationEmail = async (
  providerEmail: string,
  providerName: string,
  clientName: string,
  serviceName: string,
  bookingDate: Date
) => {
  try {
    const formattedDate = bookingDate.toLocaleString('en-US', {
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Service Booking</h2>
        <p>Hello ${providerName},</p>
        <p>You have received a new service booking:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Service:</strong> ${serviceName}</p>
          <p><strong>Client:</strong> ${clientName}</p>
          <p><strong>Date/Time:</strong> ${formattedDate}</p>
        </div>
        <p>Please log in to your account to confirm this booking.</p>
        <p>Thank you for using ServiceLink!</p>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: providerEmail,
      subject: 'New Service Booking Request',
      html: emailContent
    };

    const result = await transporter.sendMail(mailOptions);
    return result.accepted.length > 0;
  } catch (error) {
    console.error('Error sending booking notification email:', error);
    return false;
  }
};

export const registerClient = async (
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

    // Generate verification code (6 digits)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 24); // Code valid for 24 hours

    // Create new user with client profile and verification code
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        role: 'CLIENT',
        isVerified: false,
        client: {
          create: {}
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
        client: true,
        verificationTokens: true
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

export const updateClientProfile = async (
  userId: string,
  data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    profilePicture?: string;
  }
) => {
  try {
    // Find user by id
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { client: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.client) {
      throw new Error('Client profile not found');
    }

    // Update user information
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName ?? user.firstName,
        lastName: data.lastName ?? user.lastName,
        phone: data.phone ?? user.phone,
        profilePicture: data.profilePicture ?? user.profilePicture
      },
      include: {
        client: true
      }
    });

    // Return user without password
    const { password: _, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  } catch (error) {
    throw error;
  }
};

export const addClientAddress = async (
  userId: string,
  address: {
    type: 'HOME' | 'WORK' | 'OTHER';
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    isDefault?: boolean;
  }
) => {
  try {
    // Find user by id
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { client: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.client) {
      throw new Error('Client profile not found');
    }

    // If the new address is set as default, update all existing addresses to non-default
    if (address.isDefault) {
      await prisma.address.updateMany({
        where: { clientId: user.client.id },
        data: { isDefault: false }
      });
    }

    // Create new address
    const newAddress = await prisma.address.create({
      data: {
        clientId: user.client.id,
        type: address.type,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
        isDefault: address.isDefault ?? false
      }
    });

    return newAddress;
  } catch (error) {
    throw error;
  }
};

export const getClientAddresses = async (userId: string) => {
  try {
    // Find user by id
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        client: {
          include: {
            addresses: true
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.client) {
      throw new Error('Client profile not found');
    }

    return user.client.addresses;
  } catch (error) {
    throw error;
  }
};

export const updateClientAddress = async (
  userId: string,
  addressId: string,
  data: {
    type?: 'HOME' | 'WORK' | 'OTHER';
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    isDefault?: boolean;
  }
) => {
  try {
    // Find user by id
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { client: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.client) {
      throw new Error('Client profile not found');
    }

    // Verify the address belongs to this client
    const address = await prisma.address.findUnique({
      where: { id: addressId }
    });

    if (!address || address.clientId !== user.client.id) {
      throw new Error('Address not found or does not belong to this client');
    }

    // If setting this address as default, update all other addresses
    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { 
          clientId: user.client.id,
          id: { not: addressId }
        },
        data: { isDefault: false }
      });
    }

    // Update address
    const updatedAddress = await prisma.address.update({
      where: { id: addressId },
      data
    });

    return updatedAddress;
  } catch (error) {
    throw error;
  }
};

export const deleteClientAddress = async (userId: string, addressId: string) => {
  try {
    // Find user by id
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { client: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.client) {
      throw new Error('Client profile not found');
    }

    // Verify the address belongs to this client
    const address = await prisma.address.findUnique({
      where: { id: addressId }
    });

    if (!address || address.clientId !== user.client.id) {
      throw new Error('Address not found or does not belong to this client');
    }

    // Delete address
    await prisma.address.delete({
      where: { id: addressId }
    });

    return { success: true, message: 'Address deleted successfully' };
  } catch (error) {
    throw error;
  }
};

export const setDefaultAddress = async (userId: string, addressId: string) => {
  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { client: true }
    });

    if (!user || !user.client) {
      throw new Error('Client not found');
    }

    // Find the address to verify it belongs to this client
    const address = await prisma.address.findFirst({
      where: {
        id: addressId,
        clientId: user.client.id
      }
    });

    if (!address) {
      throw new Error('Address not found or access denied');
    }

    // Transaction to reset all addresses to non-default and set this one as default
    const updatedAddress = await prisma.$transaction([
      // First unset all addresses as default
      prisma.address.updateMany({
        where: {
          clientId: user.client.id,
          isDefault: true
        },
        data: {
          isDefault: false
        }
      }),
      // Then set the specific address as default
      prisma.address.update({
        where: { id: addressId },
        data: {
          isDefault: true
        }
      })
    ]);

    // Return the updated address (second item in the transaction result array)
    return updatedAddress[1];
  } catch (error) {
    throw error;
  }
};

export const getClientProfile = async (userId: string) => {
  try {
    // Find user by id with client data and addresses
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        client: {
          include: {
            addresses: true
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.client) {
      throw new Error('Client profile not found');
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } catch (error) {
    throw error;
  }
};

export const bookService = async (
  userId: string,
  bookingData: {
    serviceId: string;
    startTime: Date;
    addressId?: string;
    notes?: string;
    title?: string;
    description?: string;
  }
) => {
  try {
    // Find client by userId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { client: true }
    });

    if (!user || !user.client) {
      throw new Error('Client not found');
    }

    // Find the service with provider details
    const service = await prisma.service.findUnique({
      where: { 
        id: bookingData.serviceId,
        isActive: true
      },
      include: {
        serviceProvider: {
          include: {
            user: true
          }
        }
      }
    });

    if (!service) {
      throw new Error('Service not found or not available');
    }

    // Check if provider is verified
    if (!service.serviceProvider.isProviderVerified) {
      throw new Error('This service provider is not verified');
    }

    // Create a new booking
    const booking = await prisma.serviceBooking.create({
      data: {
        clientId: user.client.id,
        serviceProviderId: service.serviceProvider.id,
        serviceId: service.id,
        startTime: bookingData.startTime,
        status: 'PENDING',
        addressId: bookingData.addressId,
        notes: bookingData.notes,
        title: bookingData.title || service.title,
        description: bookingData.description,
        totalAmount: service.pricing // Initial amount based on service price
      },
      include: {
        service: true,
        client: {
          include: {
            user: true
          }
        },
        serviceProvider: {
          include: {
            user: true
          }
        }
      }
    });

    // Create a notification for the provider
    await prisma.notification.create({
      data: {
        receiverId: service.serviceProvider.user.id,
        type: 'BOOKING_REQUEST',
        title: 'New Booking Request',
        message: `You have received a new booking request for "${service.title}" from ${user.firstName} ${user.lastName}.`,
        isRead: false,
        data: JSON.stringify({
          bookingId: booking.id,
          serviceId: service.id,
          clientId: user.client.id
        })
      }
    });

    // Send email notification to provider
    const emailSent = await sendBookingNotificationEmail(
      service.serviceProvider.user.email,
      `${service.serviceProvider.user.firstName} ${service.serviceProvider.user.lastName}`,
      `${user.firstName} ${user.lastName}`,
      service.title,
      bookingData.startTime
    );

    if (!emailSent) {
      console.warn(`Failed to send booking notification email to provider ${service.serviceProvider.user.email}`);
    }

    return booking;
  } catch (error) {
    throw error;
  }
};

export const getClientBookings = async (
  userId: string,
  status?: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED'
) => {
  try {
    // Find client by userId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { client: true }
    });

    if (!user || !user.client) {
      throw new Error('Client not found');
    }

    // Build query conditions
    const where: any = {
      clientId: user.client.id
    };

    // Filter by status if provided
    if (status) {
      where.status = status;
    }

    // Get all bookings for this client
    const bookings = await prisma.serviceBooking.findMany({
      where,
      include: {
        service: {
          include: {
            category: true
          }
        },
        serviceProvider: {
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
        address: true
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

export const getBookingDetails = async (userId: string, bookingId: string) => {
  try {
    // Find client by userId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { client: true }
    });

    if (!user || !user.client) {
      throw new Error('Client not found');
    }

    // Get booking with details, ensuring it belongs to this client
    const booking = await prisma.serviceBooking.findFirst({
      where: {
        id: bookingId,
        clientId: user.client.id
      },
      include: {
        service: {
          include: {
            category: true,
            skills: true
          }
        },
        serviceProvider: {
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

export const cancelBooking = async (userId: string, bookingId: string) => {
  try {
    // Find client by userId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { client: true }
    });

    if (!user || !user.client) {
      throw new Error('Client not found');
    }

    // Find the booking and ensure it belongs to this client
    const booking = await prisma.serviceBooking.findFirst({
      where: {
        id: bookingId,
        clientId: user.client.id
      },
      include: {
        service: true,
        serviceProvider: {
          include: {
            user: true
          }
        }
      }
    });

    if (!booking) {
      throw new Error('Booking not found or not authorized');
    }

    // Ensure booking can be cancelled (only PENDING or CONFIRMED bookings)
    if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
      throw new Error(`Cannot cancel a booking with status: ${booking.status}`);
    }

    // Update booking status
    const updatedBooking = await prisma.serviceBooking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' }
    });

    // Create notification for provider
    await prisma.notification.create({
      data: {
        receiverId: booking.serviceProvider.user.id,
        type: 'BOOKING_CANCELLED',
        title: 'Booking Cancelled',
        message: `Booking for "${booking.service.title}" has been cancelled by the client.`,
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
