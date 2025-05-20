import express from 'express';
import { 
  handleRegisterClient, handleUpdateClientProfile, handleGetClientProfile, 
  handleAddClientAddress, handleGetClientAddresses, handleUpdateClientAddress, 
  handleDeleteClientAddress, handleBookService, handleGetClientBookings, 
  handleGetBookingDetails, handleCancelBooking, handleSetDefaultAddress,
  handleProcessPayment, handleMarkPaymentCompleted,
  getContractsController, getContractDetailsController, signContractController,
  createReviewController, getReviewsReceivedController, getReviewsGivenController
} from '../httpControllers/clientHttpController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';
import { uploadFile } from '../middlewares/fileHandler';

const router = express.Router();

router.post('/register', handleRegisterClient);


// Profile management
router.get('/profile', authenticateToken, handleGetClientProfile);
//PROFILE UPDATE
router.put('/profile', authenticateToken, handleUpdateClientProfile);

// Address management
router.post('/address', authenticateToken, handleAddClientAddress);
router.get('/address', authenticateToken, handleGetClientAddresses);
router.put('/address/:addressId', authenticateToken, handleUpdateClientAddress);
router.delete('/address/:addressId', authenticateToken, handleDeleteClientAddress);
router.patch('/address/:addressId/default', authenticateToken, handleSetDefaultAddress);

// Service booking management
router.post('/booking', authenticateToken, handleBookService);
router.get('/booking', authenticateToken, handleGetClientBookings);
router.get('/booking/:bookingId', authenticateToken, handleGetBookingDetails);
router.post('/booking/:bookingId/cancel', authenticateToken, handleCancelBooking);

// Payment management
router.post('/booking/:bookingId/payment', authenticateToken, uploadFile.single('paymentProof'), handleProcessPayment);
router.post('/booking/:bookingId/payment/complete', authenticateToken, authorizeRoles('PROVIDER'), handleMarkPaymentCompleted);

// Contract Routes
router.get('/contracts', authenticateToken, getContractsController);
router.get('/contracts/:contractId', authenticateToken, getContractDetailsController);
router.post('/contracts/:contractId/sign', authenticateToken, signContractController);

// Review Routes
router.post('/bookings/:bookingId/reviews', authenticateToken, uploadFile.array('images', 5), createReviewController);
router.get('/reviews/received', authenticateToken, getReviewsReceivedController);
router.get('/reviews/given', authenticateToken, getReviewsGivenController);

export { router as clientRoutes };
