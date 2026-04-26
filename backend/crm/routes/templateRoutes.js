const express = require('express');
const router = express.Router();
const { createTemplate, getTemplates, updateTemplate, deleteTemplate } = require('../controllers/templateController');

// Assuming you have an authentication middleware. 
// If your file is named differently (e.g., just `auth.js`), update this import!
const { protect } = require('../middleware/authMiddleware'); 

// GET /api/templates -> Fetch all templates (No auth needed to view)
router.get('/', getTemplates);

// POST /api/templates -> Create a template (Requires login so the controller can check the email)
router.post('/', protect, createTemplate);

router.put('/:id', protect, updateTemplate);
router.delete('/:id', protect, deleteTemplate);

module.exports = router;