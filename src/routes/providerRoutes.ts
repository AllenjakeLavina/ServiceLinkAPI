import express from 'express';
import { 
  handleRegisterProvider, 
  handleUpdateProviderProfile,
  handleGetProviderProfile,
  handleAddWorkExperience,
  handleAddEducation,
  handleAddSkill,
  handleAddPortfolio,
  handleAddPortfolioWithFiles,
  handleAddDocument,
  handleCreateService,
  handleGetCategories,
  handleGetVerificationStatus,
  handleGetProviderBookings,
  handleGetProviderBookingDetails,
  handleAcceptBooking,
  handleDeclineBooking,
  handleStartService,
  handleCompleteService
} from '../httpControllers/providerHttpController';
import { authenticateToken, checkProviderVerification } from '../middlewares/authMiddleware';
import { uploadFile } from '../middlewares/fileHandler';

const router = express.Router();

// Public routes
router.post('/register', uploadFile.single('idDocument'), handleRegisterProvider);
router.get('/categories', handleGetCategories);

// Protected routes - require authentication
router.get('/profile', authenticateToken, handleGetProviderProfile);
router.get('/verification-status', authenticateToken, handleGetVerificationStatus);
router.patch('/profile', authenticateToken, handleUpdateProviderProfile);
router.post('/experience', authenticateToken, handleAddWorkExperience);
router.post('/education', authenticateToken, handleAddEducation);
router.post('/skill', authenticateToken, handleAddSkill);

// Original portfolio endpoint (without file uploads)
router.post('/portfolio', authenticateToken, handleAddPortfolio);

// New portfolio endpoint with file uploads (supports multiple files)
router.post(
  '/portfolio/upload', 
  authenticateToken, 
  uploadFile.array('files', 5), // Allow up to 5 files
  handleAddPortfolioWithFiles
);

// Document upload endpoint (single file)
router.post(
  '/document', 
  authenticateToken,
  uploadFile.single('file'),
  handleAddDocument
);

// Routes requiring verification - provider must be verified by admin
router.post('/service', authenticateToken, checkProviderVerification, handleCreateService);

// Booking management routes
router.get('/bookings', authenticateToken, handleGetProviderBookings);
router.get('/bookings/:bookingId', authenticateToken, handleGetProviderBookingDetails);
router.post('/bookings/:bookingId/accept', authenticateToken, handleAcceptBooking);
router.post('/bookings/:bookingId/decline', authenticateToken, handleDeclineBooking);
router.post('/bookings/:bookingId/start', authenticateToken, handleStartService);
router.post('/bookings/:bookingId/complete', authenticateToken, handleCompleteService);

export const providerRoutes = router;
