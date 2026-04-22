// backend/routes/contactRoutes.js
const express = require('express');
const router = express.Router();
const { createContact, getAllContacts } = require('../controllers/contactController');

// Map the routes to the controller functions
router.route('/')
  .post(createContact)
  .get(getAllContacts);

module.exports = router;