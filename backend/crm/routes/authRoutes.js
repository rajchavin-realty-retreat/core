// backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { registerUser, loginUser, updateUserProfile, updateUserPassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware'); // Your auth middleware

router.post('/register', registerUser);
router.post('/login', loginUser);
router.put('/profile', protect, updateUserProfile);
router.put('/password', protect, updateUserPassword);

module.exports = router;