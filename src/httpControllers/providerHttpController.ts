import { Request, Response } from 'express';
import { registerProvider, updateProviderProfile, getProviderProfile, addWorkExperience, addEducation, 
  addSkill, addPortfolio, createService, getCategories, 
  addDocument, getProviderVerificationStatus, createProviderVerificationNotification,
  getProviderBookings, getProviderBookingDetails, acceptBooking, declineBooking, startService, completeService} from '../functionControllers/providerFunctionController';
import { uploadFile, getFileUrl } from '../middlewares/fileHandler';
import multer from 'multer';
import express from 'express';

export const handleRegisterProvider = async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    // Validate input
    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({ 
        success: false, 
        message: 'Email, password, first name, and last name are required' 
      }); 
      return;
    }

    // Check if ID document was uploaded
    let idDocument = undefined;
    if (req.file) {
      console.log('File uploaded during registration:', {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        filename: req.file.filename,
        path: req.file.path
      });
      
      idDocument = {
        title: 'Identity Document',
        fileUrl: getFileUrl(req, req.file)
      };
      
      console.log('Generated file URL:', idDocument.fileUrl);
    } else {
      console.log('No file uploaded during registration');
    }

    const user = await registerProvider(email, password, firstName, lastName, phone, idDocument);

    res.status(201).json({
      success: true,
      message: 'Service provider registered successfully. Your account and ID documents will be verified by an admin before you can offer services.',
      data: user
    }); 
    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Error during provider registration:', error);
    res.status(400).json({ 
      success: false, 
      message: errorMessage 
    }); 
    return;
  }
};

export const handleUpdateProviderProfile = async (req: Request, res: Response) => {
  try {
    // Get the user ID from the JWT token
    const userId = req.user.id;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found in token'
      });
      return;
    }

    const { firstName, lastName, phone, profilePicture, bio, headline, hourlyRate } = req.body;
    
    // At least one field should be updated
    if (!firstName && !lastName && !phone && !profilePicture && 
        bio === undefined && headline === undefined && hourlyRate === undefined) {
      res.status(400).json({
        success: false,
        message: 'At least one field is required for update'
      });
      return;
    }

    const updatedUser = await updateProviderProfile(userId, {
      firstName,
      lastName,
      phone,
      profilePicture,
      bio,
      headline,
      hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(400).json({
      success: false,
      message: errorMessage
    });
    return;
  }
};

export const handleGetProviderProfile = async (req: Request, res: Response) => {
  try {
    // Get the user ID from the JWT token
    const userId = req.user.id;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found in token'
      });
      return;
    }

    const profile = await getProviderProfile(userId);

    res.status(200).json({
      success: true,
      data: profile
    });
    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(400).json({
      success: false,
      message: errorMessage
    });
    return;
  }
};

export const handleAddWorkExperience = async (req: Request, res: Response) => {
  try {
    // Get the user ID from the JWT token
    const userId = req.user.id;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found in token'
      });
      return;
    }

    const { company, position, startDate, endDate, description, isCurrentPosition } = req.body;

    // Validate required fields
    if (!company || !position || !startDate) {
      res.status(400).json({
        success: false,
        message: 'Company, position, and start date are required'
      });
      return;
    }

    const newExperience = await addWorkExperience(userId, {
      company,
      position,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      description,
      isCurrentPosition
    });

    res.status(201).json({
      success: true,
      message: 'Work experience added successfully',
      data: newExperience
    });
    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(400).json({
      success: false,
      message: errorMessage
    });
    return;
  }
};

export const handleAddEducation = async (req: Request, res: Response) => {
  try {
    // Get the user ID from the JWT token
    const userId = req.user.id;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found in token'
      });
      return;
    }

    const { institution, degree, fieldOfStudy, startDate, endDate, isCurrentlyStudying } = req.body;

    // Validate required fields
    if (!institution || !degree || !startDate) {
      res.status(400).json({
        success: false,
        message: 'Institution, degree, and start date are required'
      });
      return;
    }

    const newEducation = await addEducation(userId, {
      institution,
      degree,
      fieldOfStudy,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      isCurrentlyStudying
    });

    res.status(201).json({
      success: true,
      message: 'Education added successfully',
      data: newEducation
    });
    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(400).json({
      success: false,
      message: errorMessage
    });
    return;
  }
};

export const handleAddSkill = async (req: Request, res: Response) => {
  try {
    // Get the user ID from the JWT token
    const userId = req.user.id;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found in token'
      });
      return;
    }

    const { skillName } = req.body;

    // Validate required fields
    if (!skillName) {
      res.status(400).json({
        success: false,
        message: 'Skill name is required'
      });
      return;
    }

    const skill = await addSkill(userId, skillName);

    res.status(201).json({
      success: true,
      message: 'Skill added successfully',
      data: skill
    });
    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(400).json({
      success: false,
      message: errorMessage
    });
    return;
  }
};

export const handleAddPortfolio = async (req: Request, res: Response) => {
  try {
    // Get the user ID from the JWT token
    const userId = req.user.id;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found in token'
      });
      return;
    }

    const { title, description, imageUrls, projectUrl } = req.body;

    // Validate required fields
    if (!title) {
      res.status(400).json({
        success: false,
        message: 'Title is required'
      });
      return;
    }

    const newPortfolio = await addPortfolio(userId, {
      title,
      description,
      imageUrls,
      projectUrl
    });

    res.status(201).json({
      success: true,
      message: 'Portfolio item added successfully',
      data: newPortfolio
    });
    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(400).json({
      success: false,
      message: errorMessage
    });
    return;
  }
};

export const handleAddPortfolioWithFiles = async (req: Request, res: Response) => {
  try {
    // Get the user ID from the JWT token
    const userId = req.user.id;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found in token'
      });
      return;
    }

    const { title, description, projectUrl } = req.body;

    // Validate required fields
    if (!title) {
      res.status(400).json({
        success: false,
        message: 'Title is required'
      });
      return;
    }

    // Process uploaded files
    let fileUrls: string[] = [];
    if (req.files && Array.isArray(req.files)) {
      fileUrls = (req.files as Express.Multer.File[]).map(file => getFileUrl(req, file));
    } else if (req.file) {
      fileUrls = [getFileUrl(req, req.file)];
    }

    const newPortfolio = await addPortfolio(userId, {
      title,
      description,
      imageUrls: fileUrls.length > 0 ? fileUrls : undefined,
      projectUrl
    });

    res.status(201).json({
      success: true,
      message: 'Portfolio item added successfully',
      data: newPortfolio
    });
    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(400).json({
      success: false,
      message: errorMessage
    });
    return;
  }
};

export const handleAddDocument = async (req: Request, res: Response) => {
  try {
    // Get the user ID from the JWT token
    const userId = req.user.id;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found in token'
      });
      return;
    }

    const { title, type } = req.body;

    // Validate required fields
    if (!title || !type) {
      res.status(400).json({
        success: false,
        message: 'Title and document type are required'
      });
      return;
    }

    // Check if file was uploaded
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'File upload is required'
      });
      return;
    }

    const fileUrl = getFileUrl(req, req.file);

    // Add document function (create this in providerFunctionController)
    const newDocument = await addDocument(userId, {
      title,
      type,
      fileUrl
    });

    res.status(201).json({
      success: true,
      message: 'Document added successfully',
      data: newDocument
    });
    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(400).json({
      success: false,
      message: errorMessage
    });
    return;
  }
};

export const handleGetVerificationStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found in token'
      });
      return;
    }

    const verificationStatus = await getProviderVerificationStatus(userId);

    // Create/resend a notification if not verified
    if (!verificationStatus.isVerified) {
      try {
        await createProviderVerificationNotification(userId);
      } catch (error) {
        console.error('Failed to create verification notification:', error);
      }
    }

    res.status(200).json({
      success: true,
      data: verificationStatus
    });
    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(400).json({
      success: false,
      message: errorMessage
    });
    return;
  }
};

export const handleCreateService = async (req: Request, res: Response) => {
  try {
    // Get the user ID from the JWT token
    const userId = req.user.id;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found in token'
      });
      return;
    }

    // Check if provider is verified
    const verificationStatus = await getProviderVerificationStatus(userId);
    if (!verificationStatus.isVerified) {
      res.status(403).json({
        success: false,
        message: 'Your provider account is pending verification by admin. You will be notified when your account is approved. Please complete your profile and upload all necessary identification documents to expedite the verification process.'
      });
      return;
    }

    const { title, description, categoryId, pricing, pricingType, imageUrls, skillIds } = req.body;

    // Validate required fields
    if (!title || !description || !categoryId || pricing === undefined || !pricingType) {
      res.status(400).json({
        success: false,
        message: 'Title, description, category ID, pricing, and pricing type are required'
      });
      return;
    }

    const newService = await createService(userId, {
      title,
      description,
      categoryId,
      pricing: parseFloat(pricing),
      pricingType,
      imageUrls,
      skillIds
    });

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: newService
    });
    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(400).json({
      success: false,
      message: errorMessage
    });
    return;
  }
};

export const handleGetCategories = async (req: Request, res: Response) => {
  try {
    const categories = await getCategories();

    res.status(200).json({
      success: true,
      data: categories
    });
    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(400).json({
      success: false,
      message: errorMessage
    });
    return;
  }
};

export const handleGetProviderBookings = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found in token'
      });
      return;
    }

    const status = req.query.status as string | undefined;
    const bookings = await getProviderBookings(userId, status as any);

    res.status(200).json({
      success: true,
      data: bookings
    });
    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(400).json({
      success: false,
      message: errorMessage
    });
    return;
  }
};

export const handleGetProviderBookingDetails = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const bookingId = req.params.bookingId;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found in token'
      });
      return;
    }

    if (!bookingId) {
      res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
      return;
    }

    const booking = await getProviderBookingDetails(userId, bookingId);

    res.status(200).json({
      success: true,
      data: booking
    });
    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(400).json({
      success: false,
      message: errorMessage
    });
    return;
  }
};

export const handleAcceptBooking = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const bookingId = req.params.bookingId;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found in token'
      });
      return;
    }

    if (!bookingId) {
      res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
      return;
    }

    const booking = await acceptBooking(userId, bookingId);

    res.status(200).json({
      success: true,
      message: 'Booking accepted successfully',
      data: booking
    });
    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(400).json({
      success: false,
      message: errorMessage
    });
    return;
  }
};

export const handleDeclineBooking = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const bookingId = req.params.bookingId;
    const { reason } = req.body;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found in token'
      });
      return;
    }

    if (!bookingId) {
      res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
      return;
    }

    const booking = await declineBooking(userId, bookingId, reason);

    res.status(200).json({
      success: true,
      message: 'Booking declined successfully',
      data: booking
    });
    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(400).json({
      success: false,
      message: errorMessage
    });
    return;
  }
};

export const handleStartService = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const bookingId = req.params.bookingId;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found in token'
      });
      return;
    }

    if (!bookingId) {
      res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
      return;
    }

    const booking = await startService(userId, bookingId);

    res.status(200).json({
      success: true,
      message: 'Service started successfully',
      data: booking
    });
    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(400).json({
      success: false,
      message: errorMessage
    });
    return;
  }
};

export const handleCompleteService = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const bookingId = req.params.bookingId;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found in token'
      });
      return;
    }

    if (!bookingId) {
      res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
      return;
    }

    const booking = await completeService(userId, bookingId);

    res.status(200).json({
      success: true,
      message: 'Service completed successfully',
      data: booking
    });
    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(400).json({
      success: false,
      message: errorMessage
    });
    return;
  }
};
