const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadFile } = require('../controllers/uploadController');
const { protect } = require('../middleware/authMiddleware'); // Assuming you want only logged-in users to upload

// Configure Multer to temporarily store the file on disk before sending to Cloudinary
const upload = multer({ dest: 'uploads/' }); 

// The Route: POST /api/upload
// It first passes through 'protect', then 'multer', then hits your controller
router.post('/', protect, upload.single('file'), uploadFile);

module.exports = router;