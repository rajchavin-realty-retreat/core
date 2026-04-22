// backend/controllers/contactController.js
const Contact = require('../models/Contact');

// @desc    Create a new contact
// @route   POST /api/contacts
exports.createContact = async (req, res) => {
  try {
    const { name, email, phone, company, status, notes } = req.body;
    
    // Check if contact already exists
    const existingContact = await Contact.findOne({ email });
    if (existingContact) {
      return res.status(400).json({ message: 'A contact with this email already exists' });
    }

    const contact = new Contact({ name, email, phone, company, status, notes });
    await contact.save();
    
    res.status(201).json(contact);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all contacts
// @route   GET /api/contacts
exports.getAllContacts = async (req, res) => {
  try {
    // Fetches all contacts, sorted by newest first
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.status(200).json(contacts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};