// backend/controllers/clientController.js
const Client = require('../models/Client');

// @desc    Create a new client
// @route   POST /api/clients
// @access  Private (Requires Token)
exports.createClient = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    
    const clientExists = await Client.findOne({ email });
    if (clientExists) return res.status(400).json({ message: 'Client already exists' });

    // Notice we grab the ID from req.user (provided by our auth middleware)
    const client = await Client.create({
      name,
      email,
      phone,
      createdBy: req.user._id 
    });

    res.status(201).json(client);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all clients (with employee info attached)
// @route   GET /api/clients
// @access  Private
exports.getClients = async (req, res) => {
  try {
    // .populate() pulls in the name and email of the employee who created this record!
    const clients = await Client.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
      
    res.status(200).json(clients);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @access  Private
exports.getClientById = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id).populate('createdBy', 'name');
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.status(200).json(client);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};