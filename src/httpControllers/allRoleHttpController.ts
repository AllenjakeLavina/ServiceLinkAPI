import { Request, Response } from 'express';
import { loginUser, changePassword, getUserById, verifyEmailCode, resendVerificationCode, 
    forgotPassword, resetPassword, getAllServices, getServiceDetails, searchProviders, getProviderDetails,
    getUserConversations, getConversationMessages, sendMessage } from '../functionControllers/allRoleFunctionController';
import { createProviderVerificationNotification } from '../functionControllers/providerFunctionController';
import { getFileUrl } from '../middlewares/fileHandler';

export const handleLogin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
      return;
    }

    const result = await loginUser(email, password);

    // If a provider with pending verification logs in, create a notification
    if (result.providerVerificationStatus === 'pending') {
      try {
        await createProviderVerificationNotification(result.user.id);
      } catch (notifError) {
        console.error('Failed to create verification notification:', notifError);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result
    });
    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    // Determine status code based on error message
    let statusCode = 400;
    if (errorMessage.includes('not verified') || errorMessage.includes('pending verification')) {
      statusCode = 403; // Forbidden - account exists but can't be used yet
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage
    });
    return;
  }
};

export const handleChangePassword = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id; // From JWT token
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
      return;
    }

    // Validate password strength
    if (newPassword.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
      return;
    }

    const result = await changePassword(userId, currentPassword, newPassword);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
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

export const handleGetMe = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id; // From JWT token
    
    const user = await getUserById(userId);

    res.status(200).json({
      success: true,
      data: user
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

export const handleForgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Email is required'
      });
      return;
    }

    await forgotPassword(email);

    // Always return success even if email doesn't exist (for security)
    res.status(200).json({
      success: true,
      message: 'If your email exists in our system, you will receive password reset instructions'
    });
    return;
  } catch (error) {
    // For security, don't reveal specific errors
    console.error('Password reset error:', error);
    res.status(200).json({
      success: true,
      message: 'If your email exists in our system, you will receive password reset instructions'
    });
    return;
  }
};

export const handleResetPassword = async (req: Request, res: Response) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Email, token, and new password are required'
      });
      return;
    }

    // Validate password strength
    if (newPassword.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
      return;
    }

    const result = await resetPassword(email, token, newPassword);

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully'
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


export const handleResendVerificationCode = async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
  
      if (!email) {
        res.status(400).json({
          success: false,
          message: 'Email is required'
        });
        return;
      }
  
      const result = await resendVerificationCode(email);
  
      res.status(200).json({
        success: true,
        message: 'Verification code resent successfully'
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
  
  export const handleVerifyEmailCode = async (req: Request, res: Response) => {
    try {
      const { email, code } = req.body;
  
      if (!email || !code) {
        res.status(400).json({
          success: false,
          message: 'Email and verification code are required'
        });
        return;
      }
  
      const result = await verifyEmailCode(email, code);
  
      res.status(200).json({
        success: true,
        message: 'Email verified successfully'
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
  
export const handleGetAllServices = async (req: Request, res: Response) => {
  try {
    // Extract query parameters
    const { 
      categoryId, 
      minPrice, 
      maxPrice, 
      searchTerm, 
      skillIds,
      page,
      limit
    } = req.query;

    // Prepare filters object
    const filters: any = {};
    
    if (categoryId) filters.categoryId = categoryId as string;
    if (minPrice) filters.minPrice = parseFloat(minPrice as string);
    if (maxPrice) filters.maxPrice = parseFloat(maxPrice as string);
    if (searchTerm) filters.searchTerm = searchTerm as string;
    if (skillIds) {
      if (typeof skillIds === 'string') {
        filters.skillIds = [skillIds];
      } else {
        filters.skillIds = skillIds as string[];
      }
    }

    // Prepare pagination
    const pagination = {
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10
    };

    const result = await getAllServices(filters, pagination);

    res.status(200).json({
      success: true,
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

export const handleGetServiceDetails = async (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;

    if (!serviceId) {
      res.status(400).json({
        success: false,
        message: 'Service ID is required'
      });
      return;
    }

    const service = await getServiceDetails(serviceId);

    res.status(200).json({
      success: true,
      data: service
    });
    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    // Use correct status code based on the error
    const statusCode = errorMessage.includes('not found') ? 404 : 400;
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage
    });
    return;
  }
};

export const handleSearchProviders = async (req: Request, res: Response) => {
  try {
    // Extract query parameters
    const { 
      searchTerm, 
      skillIds,
      categoryId,
      page,
      limit
    } = req.query;

    // Prepare query object
    const query: any = {};
    
    if (searchTerm) query.searchTerm = searchTerm as string;
    if (categoryId) query.categoryId = categoryId as string;
    if (skillIds) {
      if (typeof skillIds === 'string') {
        query.skillIds = [skillIds];
      } else {
        query.skillIds = skillIds as string[];
      }
    }

    // Prepare pagination
    const pagination = {
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10
    };

    const result = await searchProviders(query, pagination);

    res.status(200).json({
      success: true,
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

export const handleGetProviderDetails = async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;

    if (!providerId) {
      res.status(400).json({
        success: false,
        message: 'Provider ID is required'
      });
      return;
    }

    const providerDetails = await getProviderDetails(providerId);

    res.status(200).json({
      success: true,
      data: providerDetails
    });
    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    // Use correct status code based on the error
    const statusCode = errorMessage.includes('not found') ? 404 : 400;
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage
    });
    return;
  }
};

export const handleGetConversations = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found in token'
      });
      return;
    }

    const conversations = await getUserConversations(userId);

    res.status(200).json({
      success: true,
      data: conversations
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

export const handleGetConversationMessages = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.conversationId;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found in token'
      });
      return;
    }

    if (!conversationId) {
      res.status(400).json({
        success: false,
        message: 'Conversation ID is required'
      });
      return;
    }

    const messages = await getConversationMessages(conversationId, userId);

    res.status(200).json({
      success: true,
      data: messages
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

export const handleSendMessage = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.conversationId;
    const { content, imageUrl } = req.body;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found in token'
      });
      return;
    }

    if (!conversationId) {
      res.status(400).json({
        success: false,
        message: 'Conversation ID is required'
      });
      return;
    }

    if ((!content || typeof content !== 'string' || content.trim() === '') && !imageUrl) {
      res.status(400).json({
        success: false,
        message: 'Message content or image is required'
      });
      return;
    }

    const message = await sendMessage(conversationId, userId, content || '', imageUrl);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message
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

export const handleUploadImage = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID not found in token'
      });
      return;
    }

    // Check if file was uploaded
    if (!req.file) {
      console.error('No file found in request:', req.body);
      res.status(400).json({
        success: false,
        message: 'Image file is required'
      });
      return;
    }

    // Get the URL for the uploaded file
    const fileUrl = getFileUrl(req, req.file);
    console.log('Image uploaded successfully:', fileUrl);

    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: fileUrl
    });
    return;
  } catch (error) {
    console.error('Error in upload image handler:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(400).json({
      success: false,
      message: errorMessage
    });
    return;
  }
};
  