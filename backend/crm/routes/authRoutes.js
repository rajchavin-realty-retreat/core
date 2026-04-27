const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// If you have an auth middleware for the profile routes, import it here:
const { protect } = require('../middleware/authMiddleware'); 

// --- NEW SAAS OTP AUTH ROUTES ---
router.post('/signup', authController.signup);
router.post('/verify-signup', authController.verifySignup);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// --- EXISTING PROFILE MANAGEMENT ROUTES ---
// Make sure to use your 'protect' middleware here if these require the user to be logged in
router.put('/profile', protect, authController.updateUserProfile);
router.put('/password', protect, authController.updateUserPassword);

module.exports = router;