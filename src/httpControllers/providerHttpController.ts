import { Request, Response } from 'express';
import { registerProvider, updateProviderProfile, getProviderProfile, addWorkExperience, addEducation, 
  addSkill, addPortfolio, createService, getCategories, 
  addDocument, getProviderVerificationStatus, createProviderVerificationNotification,
  getProviderBookings, getProviderBookingDetails, acceptBooking, declineBooking, startService, completeService,
  getContractDetails, createContract, updateContract, signContract,
  createClientReview, getReviewsReceived, getReviewsGiven, getServiceProviderReviews,
  addAvailabilitySlot, getAvailability, updateAvailabilitySlot, deleteAvailabilitySlot, getProviderServices, updateProviderService } from '../functionControllers/providerFunctionController';
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
    
    console.log('Update provider profile request received:', {
      userId,
      body: req.body,
      file: req.file
    });
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found in token'
      });
      return;
    }

    // Handle file upload if present
    let profilePicture = req.body.profilePicture;
    if (req.file) {
      console.log('Profile picture file detected in request');
      profilePicture = getFileUrl(req, req.file);
      console.log('Generated profile picture URL:', profilePicture);
    }

    // Extract fields from request body
    const { firstName, lastName, phone, bio, headline, hourlyRate } = req.body;
    
    const updateData: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      profilePicture?: string;
      bio?: string;
      headline?: string;
      hourlyRate?: number;
    } = {
      firstName,
      lastName,
      phone,
      profilePicture,
      bio,
      headline,
      hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined
    };
    
    console.log('Filtered update data:', updateData);
    
    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });
    
    console.log('Final update data after filtering:', updateData);
    
    // At least one field should be updated
    if (Object.keys(updateData).length === 0) {
      console.error('No fields provided for update');
      res.status(400).json({
        success: false,
        message: 'At least one field is required for update'
      });
      return;
    }

    const updatedUser = await updateProviderProfile(userId, updateData);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Error updating provider profile:', error);
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

export const handleGetProviderServices = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found in token'
      });
      return;
    }

    const services = await getProviderServices(userId);

    res.status(200).json({
      success: true,
      data: services
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

export const handleUpdateProviderService = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const serviceId = req.params.serviceId;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found in token'
      });
      return;
    }

    if (!serviceId) {
      res.status(400).json({
        success: false,
        message: 'Service ID is required'
      });
      return;
    }

    const { title, description, categoryId, pricing, pricingType, imageUrls, isActive, skillIds } = req.body;

    // At least one field should be provided for update
    if (!title && !description && !categoryId && pricing === undefined && 
        !pricingType && imageUrls === undefined && isActive === undefined && !skillIds) {
      res.status(400).json({
        success: false,
        message: 'At least one field is required for update'
      });
      return;
    }

    const updatedService = await updateProviderService(userId, serviceId, {
      title,
      description,
      categoryId,
      pricing: pricing !== undefined ? parseFloat(pricing) : undefined,
      pricingType,
      imageUrls,
      isActive,
      skillIds
    });

    res.status(200).json({
      success: true,
      message: 'Service updated successfully',
      data: updatedService
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

// Contract HTTP Controllers
export const getContractController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { contractId } = req.params;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized - User not authenticated'
      });
      return;
    }

    if (!contractId) {
      res.status(400).json({
        success: false,
        message: 'Contract ID is required'
      });
      return;
    }

    const contract = await getContractDetails(userId, contractId);
    
    res.status(200).json({
      success: true,
      data: contract
    });
  } catch (error: any) {
    console.error('Error in getContractController:', error);
    
    if (error.message.includes('Not authorized') || error.message.includes('Contract not found')) {
      res.status(404).json({
        success: false,
        message: error.message
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get contract details',
      error: error
    });
  }
};

export const createContractController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { bookingId } = req.params;
    const contractData = req.body;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized - User not authenticated'
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

    if (!contractData || !contractData.terms || !contractData.paymentAmount || !contractData.paymentType) {
      res.status(400).json({
        success: false,
        message: 'Contract terms, payment amount, and payment type are required'
      });
      return;
    }

    const contract = await createContract(userId, bookingId, contractData);
    
    res.status(201).json({
      success: true,
      message: 'Contract created successfully',
      data: contract
    });
  } catch (error: any) {
    console.error('Error in createContractController:', error);
    
    if (error.message.includes('Not authorized') || 
        error.message.includes('Booking not found') ||
        error.message.includes('already exists')) {
      res.status(400).json({
        success: false,
        message: error.message
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create contract',
      error: error
    });
  }
};

export const updateContractController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { contractId } = req.params;
    const contractData = req.body;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized - User not authenticated'
      });
      return;
    }

    if (!contractId) {
      res.status(400).json({
        success: false,
        message: 'Contract ID is required'
      });
      return;
    }

    // At least one field should be provided for update
    if (!contractData || (
        !contractData.terms && 
        !contractData.paymentAmount && 
        !contractData.paymentType)) {
      res.status(400).json({
        success: false,
        message: 'At least one field (terms, paymentAmount, paymentType) must be provided for update'
      });
      return;
    }

    const updatedContract = await updateContract(userId, contractId, contractData);
    
    res.status(200).json({
      success: true,
      message: 'Contract updated successfully',
      data: updatedContract
    });
  } catch (error: any) {
    console.error('Error in updateContractController:', error);
    
    if (error.message.includes('Not authorized') || 
        error.message.includes('Contract not found') ||
        error.message.includes('Cannot update')) {
      res.status(400).json({
        success: false,
        message: error.message
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update contract',
      error: error
    });
  }
};

export const signContractController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { contractId } = req.params;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized - User not authenticated'
      });
      return;
    }

    if (!contractId) {
      res.status(400).json({
        success: false,
        message: 'Contract ID is required'
      });
      return;
    }

    const signedContract = await signContract(userId, contractId);
    
    res.status(200).json({
      success: true,
      message: 'Contract signed successfully',
      data: signedContract
    });
  } catch (error: any) {
    console.error('Error in signContractController:', error);
    
    if (error.message.includes('Not authorized') || 
        error.message.includes('Contract not found') ||
        error.message.includes('already signed')) {
      res.status(400).json({
        success: false,
        message: error.message
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to sign contract',
      error: error
    });
  }
};

// Review HTTP Controllers
export const createReviewController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { bookingId } = req.params;
    const { rating, comment } = req.body;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized - User not authenticated'
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

    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({
        success: false,
        message: 'Rating is required and must be between 1 and 5'
      });
      return;
    }

    const review = await createClientReview(userId, bookingId, { rating, comment });
    
    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      data: review
    });
  } catch (error: any) {
    console.error('Error in createReviewController:', error);
    
    if (error.message.includes('already reviewed') || 
        error.message.includes('not completed') || 
        error.message.includes('not authorized') ||
        error.message.includes('not found')) {
      res.status(400).json({
        success: false,
        message: error.message
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create review',
      error: error
    });
  }
};

export const getReviewsReceivedController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized - User not authenticated'
      });
      return;
    }

    const reviews = await getReviewsReceived(userId);
    
    res.status(200).json({
      success: true,
      data: reviews
    });
  } catch (error: any) {
    console.error('Error in getReviewsReceivedController:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get reviews',
      error: error
    });
  }
};

export const getReviewsGivenController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized - User not authenticated'
      });
      return;
    }

    const reviews = await getReviewsGiven(userId);
    
    res.status(200).json({
      success: true,
      data: reviews
    });
  } catch (error: any) {
    console.error('Error in getReviewsGivenController:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get reviews',
      error: error
    });
  }
};

export const getProviderReviewsController = async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    
    if (!providerId) {
      res.status(400).json({
        success: false,
        message: 'Provider ID is required'
      });
      return;
    }

    const providerReviews = await getServiceProviderReviews(providerId);
    
    res.status(200).json({
      success: true,
      data: providerReviews
    });
  } catch (error: any) {
    console.error('Error in getProviderReviewsController:', error);
    if (error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        message: error.message
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get provider reviews',
      error: error
    });
  }
};

// Availability HTTP Controllers
export const addAvailabilitySlotController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { dayOfWeek, startTime, endTime, isAvailable } = req.body;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized - User not authenticated'
      });
      return;
    }

    // Validate required fields
    if (dayOfWeek === undefined || !startTime || !endTime) {
      res.status(400).json({
        success: false,
        message: 'Day of week, start time, and end time are required'
      });
      return;
    }

    const availabilitySlot = await addAvailabilitySlot(userId, {
      dayOfWeek: parseInt(dayOfWeek),
      startTime,
      endTime,
      isAvailable
    });
    
    res.status(201).json({
      success: true,
      message: 'Availability slot added successfully',
      data: availabilitySlot
    });
  } catch (error: any) {
    console.error('Error in addAvailabilitySlotController:', error);
    
    if (error.message.includes('Day of week') || 
        error.message.includes('format') || 
        error.message.includes('after start time') ||
        error.message.includes('overlaps')) {
      res.status(400).json({
        success: false,
        message: error.message
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add availability slot',
      error: error
    });
  }
};

export const getAvailabilityController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized - User not authenticated'
      });
      return;
    }

    const availability = await getAvailability(userId);
    
    res.status(200).json({
      success: true,
      data: availability
    });
  } catch (error: any) {
    console.error('Error in getAvailabilityController:', error);
    
    if (error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        message: error.message
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get availability',
      error: error
    });
  }
};

export const updateAvailabilitySlotController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { slotId } = req.params;
    const { startTime, endTime, isAvailable } = req.body;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized - User not authenticated'
      });
      return;
    }

    if (!slotId) {
      res.status(400).json({
        success: false,
        message: 'Availability slot ID is required'
      });
      return;
    }

    // At least one field should be provided for update
    if (startTime === undefined && endTime === undefined && isAvailable === undefined) {
      res.status(400).json({
        success: false,
        message: 'At least one field (startTime, endTime, isAvailable) must be provided for update'
      });
      return;
    }

    const updatedSlot = await updateAvailabilitySlot(userId, slotId, {
      startTime,
      endTime,
      isAvailable
    });
    
    res.status(200).json({
      success: true,
      message: 'Availability slot updated successfully',
      data: updatedSlot
    });
  } catch (error: any) {
    console.error('Error in updateAvailabilitySlotController:', error);
    
    if (error.message.includes('permission') || 
        error.message.includes('not found') ||
        error.message.includes('format') ||
        error.message.includes('after start time') ||
        error.message.includes('overlap')) {
      res.status(400).json({
        success: false,
        message: error.message
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update availability slot',
      error: error
    });
  }
};

export const deleteAvailabilitySlotController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { slotId } = req.params;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized - User not authenticated'
      });
      return;
    }

    if (!slotId) {
      res.status(400).json({
        success: false,
        message: 'Availability slot ID is required'
      });
      return;
    }

    const result = await deleteAvailabilitySlot(userId, slotId);
    
    res.status(200).json({
      success: true,
      message: 'Availability slot deleted successfully'
    });
  } catch (error: any) {
    console.error('Error in deleteAvailabilitySlotController:', error);
    
    if (error.message.includes('permission') || error.message.includes('not found')) {
      res.status(400).json({
        success: false,
        message: error.message
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete availability slot',
      error: error
    });
  }
};
