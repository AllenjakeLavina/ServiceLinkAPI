import express from 'express';
import { 
  handleRegisterClient, 
  handleUpdateClientProfile,
  handleGetClientProfile,
  handleAddClientAddress,
  handleGetClientAddresses,
  handleUpdateClientAddress,
  handleDeleteClientAddress,
  handleSetDefaultAddress,
  handleBookService,
  handleGetClientBookings,
  handleGetBookingDetails,
  handleCancelBooking
} from '../httpControllers/clientHttpController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/register', handleRegisterClient);


// Profile management
router.get('/profile', authenticateToken, handleGetClientProfile);
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

export { router as clientRoutes };
