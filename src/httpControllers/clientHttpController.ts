import { Request, Response } from 'express';
import { registerClient,  updateClientProfile,
     addClientAddress, getClientAddresses, updateClientAddress, deleteClientAddress, getClientProfile,
     bookService, getClientBookings, getBookingDetails, cancelBooking, setDefaultAddress,
     processPayment, markPaymentCompleted, getClientContracts, getClientContractDetails, signContract,
     createReview, getReviewsReceived, getReviewsGiven } from '../functionControllers/clientFunctionController';

export const handleRegisterClient = async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    // Validate input
    if (!email || !password || !firstName || !lastName) {
     res.status(400).json({ 
        success: false, 
        message: 'Email, password, first name, and last name are required' 
      }); return;
    }

    const user = await registerClient(email, password, firstName, lastName, phone);

    res.status(201).json({
      success: true,
      message: 'Client registered successfully',
      data: user
    }); return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(400).json({ 
      success: false, 
      message: errorMessage 
    }); return;
  }
};

export const handleUpdateClientProfile = async (req: Request, res: Response) => {
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

    const { firstName, lastName, phone, profilePicture } = req.body;
    
    // At least one field should be updated
    if (!firstName && !lastName && !phone && !profilePicture) {
      res.status(400).json({
        success: false,
        message: 'At least one field is required for update'
      });
      return;
    }

    const updatedUser = await updateClientProfile(userId, {
      firstName,
      lastName,
      phone,
      profilePicture
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

export const handleAddClientAddress = async (req: Request, res: Response) => {
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

    const { 
      type, 
      addressLine1, 
      addressLine2, 
      city, 
      state, 
      postalCode, 
      country, 
      isDefault 
    } = req.body;

    // Validate required fields
    if (!addressLine1 || !city || !state || !postalCode || !country) {
      res.status(400).json({
        success: false,
        message: 'Address line 1, city, state, postal code, and country are required'
      });
      return;
    }

    const newAddress = await addClientAddress(userId, {
      type: type || 'HOME',
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      isDefault
    });

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      data: newAddress
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

export const handleGetClientAddresses = async (req: Request, res: Response) => {
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

    const addresses = await getClientAddresses(userId);

    res.status(200).json({
      success: true,
      data: addresses
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

export const handleUpdateClientAddress = async (req: Request, res: Response) => {
  try {
    // Get the user ID from the JWT token
    const userId = req.user.id;
    const { addressId } = req.params;
    
    if (!userId || !addressId) {
      res.status(400).json({
        success: false,
        message: 'User ID and Address ID are required'
      });
      return;
    }

    const { 
      type, 
      addressLine1, 
      addressLine2, 
      city, 
      state, 
      postalCode, 
      country, 
      isDefault 
    } = req.body;

    // Ensure at least one field to update
    if (!type && !addressLine1 && !addressLine2 && !city && !state && 
        !postalCode && !country && typeof isDefault === 'undefined') {
      res.status(400).json({
        success: false,
        message: 'At least one field is required for update'
      });
      return;
    }

    const updatedAddress = await updateClientAddress(userId, addressId, {
      type,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      isDefault
    });

    res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      data: updatedAddress
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

export const handleDeleteClientAddress = async (req: Request, res: Response) => {
  try {
    // Get the user ID from the JWT token
    const userId = req.user.id;
    const { addressId } = req.params;
    
    if (!userId || !addressId) {
      res.status(400).json({
        success: false,
        message: 'User ID and Address ID are required'
      });
      return;
    }

    const result = await deleteClientAddress(userId, addressId);

    res.status(200).json({
      success: true,
      message: 'Address deleted successfully'
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

export const handleGetClientProfile = async (req: Request, res: Response) => {
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

    const profile = await getClientProfile(userId);

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

export const handleBookService = async (req: Request, res: Response) => {
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

    const { serviceId, startTime, addressId, notes, title, description } = req.body;

    // Validate required fields
    if (!serviceId || !startTime) {
      res.status(400).json({
        success: false,
        message: 'Service ID and start time are required'
      });
      return;
    }

    // Parse the startTime string to Date
    const bookingStartTime = new Date(startTime);
    if (isNaN(bookingStartTime.getTime())) {
      res.status(400).json({
        success: false,
        message: 'Invalid start time format'
      });
      return;
    }

    // Book the service
    const booking = await bookService(userId, {
      serviceId,
      startTime: bookingStartTime,
      addressId,
      notes,
      title,
      description
    });

    res.status(201).json({
      success: true,
      message: 'Service booked successfully. The provider will be notified.',
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

export const handleGetClientBookings = async (req: Request, res: Response) => {
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

    // Get status filter from query parameter if provided
    const { status } = req.query;
    
    // Validate status if provided
    const validStatuses = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED'];
    if (status && !validStatuses.includes(status as string)) {
      res.status(400).json({
        success: false,
        message: 'Invalid status filter'
      });
      return;
    }

    const bookings = await getClientBookings(userId, status as any);

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

export const handleGetBookingDetails = async (req: Request, res: Response) => {
  try {
    // Get the user ID from the JWT token
    const userId = req.user.id;
    const { bookingId } = req.params;
    
    if (!userId || !bookingId) {
      res.status(400).json({
        success: false,
        message: 'User ID and Booking ID are required'
      });
      return;
    }

    const booking = await getBookingDetails(userId, bookingId);

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

export const handleCancelBooking = async (req: Request, res: Response) => {
  try {
    // Get the user ID from the JWT token
    const userId = req.user.id;
    const { bookingId } = req.params;
    
    if (!userId || !bookingId) {
      res.status(400).json({
        success: false,
        message: 'User ID and Booking ID are required'
      });
      return;
    }

    const cancelledBooking = await cancelBooking(userId, bookingId);

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: cancelledBooking
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

export const handleSetDefaultAddress = async (req: Request, res: Response) => {
  try {
    // Get the user ID from the JWT token
    const userId = req.user.id;
    const { addressId } = req.params;
    
    if (!userId || !addressId) {
      res.status(400).json({
        success: false,
        message: 'User ID and Address ID are required'
      });
      return;
    }

    const updatedAddress = await setDefaultAddress(userId, addressId);

    res.status(200).json({
      success: true,
      message: 'Default address updated successfully',
      data: updatedAddress
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

export const handleProcessPayment = async (req: Request, res: Response) => {
  try {
    // Get the user ID from the JWT token
    const userId = req.user.id;
    const { bookingId } = req.params;
    
    if (!userId || !bookingId) {
      res.status(400).json({
        success: false,
        message: 'User ID and Booking ID are required'
      });
      return;
    }

    // Get payment proof file path if file was uploaded
    let paymentProofUrl = undefined;
    if (req.file) {
      paymentProofUrl = `/uploads/${req.file.filename}`; // Store relative path
    }

    // Process the payment
    const result = await processPayment(userId, bookingId, paymentProofUrl);

    res.status(200).json({
      success: true,
      message: 'Payment processed successfully. Cash payment will be collected in person.',
      data: result
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

export const handleMarkPaymentCompleted = async (req: Request, res: Response) => {
  try {
    // Get the user ID from the JWT token
    const userId = req.user.id;
    const { bookingId } = req.params;
    
    if (!userId || !bookingId) {
      res.status(400).json({
        success: false,
        message: 'User ID and Booking ID are required'
      });
      return;
    }

    // Mark the payment as completed
    const updatedPayment = await markPaymentCompleted(userId, bookingId);

    res.status(200).json({
      success: true,
      message: 'Payment marked as completed successfully',
      data: updatedPayment
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
export const getContractsController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized - User not authenticated'
      });
      return;
    }

    const contracts = await getClientContracts(userId);
    
    res.status(200).json({
      success: true,
      data: contracts
    });
  } catch (error: any) {
    console.error('Error in getContractsController:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get contracts',
      error: error
    });
  }
};

export const getContractDetailsController = async (req: Request, res: Response) => {
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

    const contract = await getClientContractDetails(userId, contractId);
    
    res.status(200).json({
      success: true,
      data: contract
    });
  } catch (error: any) {
    console.error('Error in getContractDetailsController:', error);
    
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

    // Convert rating to float and validate
    const ratingFloat = parseFloat(rating);
    if (isNaN(ratingFloat) || ratingFloat < 1 || ratingFloat > 5) {
      res.status(400).json({
        success: false,
        message: 'Rating is required and must be between 1 and 5'
      });
      return;
    }

    // Process uploaded images
    let imageUrls: string[] = [];
    if (req.files && Array.isArray(req.files)) {
      imageUrls = (req.files as Express.Multer.File[]).map(file => `/uploads/${file.filename}`);
    }

    const review = await createReview(userId, bookingId, { 
      rating: ratingFloat,
      comment,
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined
    });
    
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
