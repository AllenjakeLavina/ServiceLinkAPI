import { Request, Response } from 'express';
import { 
  setPassword, 
  createAdminUser, 
  getAllClients,
  getAllProviders,
  changeUserPassword,
  getUnverifiedProviders,
  verifyProviderAccount,
  rejectProviderVerification,
  createCategory,
  getAllCategories,
  editCategory
} from '../functionControllers/adminFunctionController';

export const handleSetPassword = async (req: Request, res: Response) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Email and new password are required'
      });
      return;
    }

    await setPassword(email, newPassword);

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
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

export const handleCreateAdmin = async (req: Request, res: Response) => {
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

    const admin = await createAdminUser(email, password, firstName, lastName, phone);

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      data: admin
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

export const handleChangeUserPassword = async (req: Request, res: Response) => {
  try {
    const { userId, newPassword } = req.body;

    // Admin making the request
    const adminId = req.user.id;

    // Validate required fields
    if (!userId || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'User ID and new password are required'
      });
      return;
    }

    // Check if user has admin role
    if (req.user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Unauthorized: Only admins can perform this action'
      });
      return;
    }

    const result = await changeUserPassword(userId, newPassword, adminId);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
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

export const handleGetAllClients = async (req: Request, res: Response) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Unauthorized: Only admins can perform this action'
      });
      return;
    }

    const clients = await getAllClients();

    res.status(200).json({
      success: true,
      data: clients
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

export const handleGetAllProviders = async (req: Request, res: Response) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Unauthorized: Only admins can perform this action'
      });
      return;
    }

    const providers = await getAllProviders();

    res.status(200).json({
      success: true,
      data: providers
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

export const handleGetUnverifiedProviders = async (req: Request, res: Response) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Unauthorized: Only admins can perform this action'
      });
      return;
    }

    const providers = await getUnverifiedProviders();

    res.status(200).json({
      success: true,
      data: providers
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

export const handleVerifyProvider = async (req: Request, res: Response) => {
  try {
    const { providerId, documentId } = req.body;

    // Admin making the request
    const adminId = req.user.id;

    // Validate required fields
    if (!providerId) {
      res.status(400).json({
        success: false,
        message: 'Provider ID is required'
      });
      return;
    }

    // Check if user has admin role
    if (req.user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Unauthorized: Only admins can perform this action'
      });
      return;
    }

    const result = await verifyProviderAccount(providerId, adminId, documentId);

    res.status(200).json({
      success: true,
      message: 'Provider account verified successfully',
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

export const handleRejectProviderVerification = async (req: Request, res: Response) => {
  try {
    const { providerId, reason } = req.body;

    // Admin making the request
    const adminId = req.user.id;

    // Validate required fields
    if (!providerId || !reason) {
      res.status(400).json({
        success: false,
        message: 'Provider ID and rejection reason are required'
      });
      return;
    }

    // Check if user has admin role
    if (req.user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Unauthorized: Only admins can perform this action'
      });
      return;
    }

    const result = await rejectProviderVerification(providerId, adminId, reason);

    res.status(200).json({
      success: true,
      message: 'Provider verification rejected successfully',
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

export const handleCreateCategory = async (req: Request, res: Response) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Unauthorized: Only admins can perform this action'
      });
      return;
    }

    const { name, description } = req.body;
    
    // Validate required fields
    if (!name) {
      res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
      return;
    }

    // Get image URL from file upload if it exists
    let imageUrl;
    if (req.file) {
      console.log('File uploaded:', req.file);
      imageUrl = `/uploads/category/${req.file.filename}`;
    }

    console.log('Creating category with image URL:', imageUrl);
    const category = await createCategory(name, description, imageUrl);

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });
    return;
  } catch (error) {
    console.error('Error in handleCreateCategory:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(400).json({
      success: false,
      message: errorMessage
    });
    return;
  }
};

export const handleGetAllCategories = async (req: Request, res: Response) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Unauthorized: Only admins can perform this action'
      });
      return;
    }

    const categories = await getAllCategories();

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

export const handleEditCategory = async (req: Request, res: Response) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Unauthorized: Only admins can perform this action'
      });
      return;
    }

    const { categoryId } = req.params;
    const { name, description } = req.body;
    
    // Validate required fields
    if (!categoryId) {
      res.status(400).json({
        success: false,
        message: 'Category ID is required'
      });
      return;
    }

    // Prepare update data
    const updateData: { name?: string; description?: string; imageUrl?: string } = {};
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    // Handle image update if file was uploaded
    if (req.file) {
      updateData.imageUrl = `/uploads/category/${req.file.filename}`;
      console.log('Updated category image:', updateData.imageUrl);
    }

    // If no update data provided, return error
    if (Object.keys(updateData).length === 0) {
      res.status(400).json({
        success: false,
        message: 'No update data provided'
      });
      return;
    }

    const updatedCategory = await editCategory(categoryId, updateData);

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: updatedCategory
    });
    return;
  } catch (error) {
    console.error('Error in handleEditCategory:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(400).json({
      success: false,
      message: errorMessage
    });
    return;
  }
};
