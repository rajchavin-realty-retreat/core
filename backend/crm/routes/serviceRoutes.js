// backend/routes/serviceRoutes.js
const express = require('express');
const router = express.Router();
const { createService, getClientServices, updateServiceStatus } = require('../controllers/serviceController');
const { protect } = require('../middleware/authMiddleware');

// Route to create a new service
router.post('/', protect, createService);

// Route to fetch services for a specific client
router.get('/client/:clientId', protect, getClientServices);

// Route to update a specific service's status
router.put('/:id', protect, updateServiceStatus);

module.exports = router;