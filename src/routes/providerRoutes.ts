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
  handleGetProviderServices,
  handleUpdateProviderService,
  handleGetCategories,
  handleGetVerificationStatus,
  handleGetProviderBookings,
  handleGetProviderBookingDetails,
  handleAcceptBooking,
  handleDeclineBooking,
  handleStartService,
  handleCompleteService,
  createReviewController,
  getReviewsReceivedController,
  getReviewsGivenController,
  getProviderReviewsController,
  addAvailabilitySlotController,
  getAvailabilityController,
  updateAvailabilitySlotController,
  deleteAvailabilitySlotController
} from '../httpControllers/providerHttpController';
import { handleMarkPaymentCompleted } from '../httpControllers/clientHttpController';
import { authenticateToken, checkProviderVerification } from '../middlewares/authMiddleware';
import { uploadFile } from '../middlewares/fileHandler';
import { getContractController, createContractController, updateContractController, signContractController } from '../httpControllers/providerHttpController';

const router = express.Router();

// Public routes
router.post('/register', uploadFile.single('idDocument'), handleRegisterProvider);
router.get('/categories', handleGetCategories);

// Protected routes - require authentication
router.get('/profile', authenticateToken, handleGetProviderProfile);
router.get('/verification-status', authenticateToken, handleGetVerificationStatus);
router.patch('/profile', authenticateToken, uploadFile.single('profilePicture'), handleUpdateProviderProfile);
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
router.get('/services', authenticateToken, handleGetProviderServices);
router.put('/services/:serviceId', authenticateToken, handleUpdateProviderService);

// Booking management routes
router.get('/bookings', authenticateToken, handleGetProviderBookings);
router.get('/bookings/:bookingId', authenticateToken, handleGetProviderBookingDetails);
router.post('/bookings/:bookingId/accept', authenticateToken, handleAcceptBooking);
router.post('/bookings/:bookingId/decline', authenticateToken, handleDeclineBooking);
router.post('/bookings/:bookingId/start', authenticateToken, handleStartService);
router.post('/bookings/:bookingId/complete', authenticateToken, handleCompleteService);

// Payment management routes
router.post('/bookings/:bookingId/payment/complete', authenticateToken, handleMarkPaymentCompleted);

// Contract Routes
router.get('/contracts/:contractId', authenticateToken, getContractController);
router.post('/bookings/:bookingId/contracts', authenticateToken, createContractController);
router.put('/contracts/:contractId', authenticateToken, updateContractController);
router.post('/contracts/:contractId/sign', authenticateToken, signContractController);

// Review Routes
router.post('/bookings/:bookingId/reviews', authenticateToken, createReviewController);
router.get('/reviews/received', authenticateToken, getReviewsReceivedController);
router.get('/reviews/given', authenticateToken, getReviewsGivenController);
router.get('/providers/:providerId/reviews', getProviderReviewsController);

// Availability Routes
router.post('/availability', authenticateToken, addAvailabilitySlotController);
router.get('/availability', authenticateToken, getAvailabilityController);
router.put('/availability/:slotId', authenticateToken, updateAvailabilitySlotController);
router.delete('/availability/:slotId', authenticateToken, deleteAvailabilitySlotController);

export const providerRoutes = router;
