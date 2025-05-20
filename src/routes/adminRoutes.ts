import express from 'express';
import { 
  handleCreateAdmin, 
  handleSetPassword, 
  handleGetUnverifiedProviders, 
  handleVerifyProvider, 
  handleRejectProviderVerification,
  handleGetAllClients,
  handleGetAllProviders,
  handleChangeUserPassword,
  handleCreateCategory,
  handleGetAllCategories,
  handleEditCategory
} from '../httpControllers/adminHttpController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';
import { uploadFile } from '../middlewares/fileHandler';

const router = express.Router();

// TEMPORARY - WARNING - REMOVE BEFORE PRODUCTION
// This route is intentionally unprotected for initial setup
router.post('/set-password', handleSetPassword);

// This route is also unprotected for initial admin creation
router.post('/create-admin', handleCreateAdmin);

// Protected admin routes (example)
router.get('/dashboard', authenticateToken, authorizeRoles('ADMIN'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Admin dashboard data',
    data: {
      stats: {
        users: 100,
        providers: 25,
        clients: 75
      }
    }
  });
});

// Protected routes - require admin authentication
// Client management
router.get('/clients', authenticateToken, authorizeRoles('ADMIN'), handleGetAllClients);

// Provider management
router.get('/providers', authenticateToken, authorizeRoles('ADMIN'), handleGetAllProviders);
router.get('/providers/unverified', authenticateToken, authorizeRoles('ADMIN'), handleGetUnverifiedProviders);
router.post('/providers/verify', authenticateToken, authorizeRoles('ADMIN'), handleVerifyProvider);
router.post('/providers/reject', authenticateToken, authorizeRoles('ADMIN'), handleRejectProviderVerification);

// User management
router.post('/users/change-password', authenticateToken, authorizeRoles('ADMIN'), handleChangeUserPassword);

// Category management
router.post(
  '/category',
  authenticateToken,
  authorizeRoles('ADMIN'),
  uploadFile.single('categoryImage'),
  handleCreateCategory
);
router.get('/category', authenticateToken, authorizeRoles('ADMIN'), handleGetAllCategories);
router.patch(
  '/category/:categoryId',
  authenticateToken,
  authorizeRoles('ADMIN'),
  uploadFile.single('categoryImage'),
  handleEditCategory
);

// Add this comment to remind yourself to secure or remove these routes
/*
  !!!! IMPORTANT !!!!
  REMOVE OR PROTECT THESE ROUTES BEFORE PRODUCTION DEPLOYMENT
  These routes are only for development and initial setup.
*/

export { router as adminRoutes };
