// backend/routes/clientRoutes.js
const express = require('express');
const router = express.Router();
const { createClient, getClients, getClientById } = require('../controllers/clientController');
const { protect } = require('../middleware/authMiddleware');

// Apply the 'protect' bouncer to these routes
router.route('/')
  .post(protect, createClient)
  .get(protect, getClients);
  // Add this below your existing '/' route
router.route('/:id').get(protect, getClientById);

module.exports = router;