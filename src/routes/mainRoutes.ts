import express from 'express';
import { 
  handleLogin, 
  handleChangePassword, 
  handleGetMe,
  handleResendVerificationCode, 
  handleVerifyEmailCode,
  handleForgotPassword,
  handleResetPassword,
  handleGetAllServices,
  handleGetServiceDetails,
  handleSearchProviders,
  handleGetProviderDetails,
  handleGetConversations,
  handleGetConversationMessages,
  handleSendMessage,
  handleUploadImage
} from '../httpControllers/allRoleHttpController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';
import { uploadFile } from '../middlewares/fileHandler';

const router = express.Router();

// Public routes
router.post('/login', handleLogin);
router.post('/forgot-password', handleForgotPassword);
router.post('/reset-password', handleResetPassword);
router.post('/resend-verification', handleResendVerificationCode);
router.post('/verify-email', handleVerifyEmailCode);

// Public service routes
router.get('/services', handleGetAllServices);
router.get('/services/:serviceId', handleGetServiceDetails);
router.get('/providers/search', handleSearchProviders);
router.get('/providers/:providerId', handleGetProviderDetails);

// Protected routes
router.get('/me', authenticateToken, handleGetMe);
router.post('/change-password', authenticateToken, handleChangePassword);

// Chat routes
router.get('/conversations', authenticateToken, handleGetConversations);
router.get('/conversations/:conversationId/messages', authenticateToken, handleGetConversationMessages);
router.post('/conversations/:conversationId/messages', authenticateToken, handleSendMessage);

// File upload route for chat images
router.post(
  '/upload-image', 
  authenticateToken, 
  uploadFile.single('image'),
  handleUploadImage
);

export { router as mainRoutes };
