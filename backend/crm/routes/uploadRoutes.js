const express = require('express');
const router = express.Router();
const { upload } = require('../config/cloudinary'); // Make sure this path points to your Cloudinary config
const { protect } = require('../middleware/authMiddleware');

// @desc    Upload a file to Cloudinary
// @route   POST /api/upload
// @access  Private
// NOTE: 'file' must match the name we used in the frontend FormData.append('file', ...)
router.post('/', protect, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    // Multer-storage-cloudinary automatically puts the secure URL in req.file.path
    res.status(200).json({ url: req.file.path });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;