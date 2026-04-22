// backend/routes/recordRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');
const { createRecord, getRecordsByEntity, deleteRecord, updateRecord } = require('../controllers/recordController');

// CHANGED: upload.any() intercepts all files, single or multiple!
router.post('/', protect, upload.any(), createRecord); 
router.get('/entity/:entityId', protect, getRecordsByEntity);
router.delete('/:id', protect, deleteRecord); // Add this
router.put('/:id', protect, updateRecord); // <-- Add the PUT route

module.exports = router;