// backend/controllers/serviceController.js
const Service = require('../models/Service');

// @desc    Create a new service/deal for a client
// @route   POST /api/services
// @access  Private
exports.createService = async (req, res) => {
  try {
    const { client, serviceType, propertyDetails, notes } = req.body;

    if (!client || !serviceType) {
      return res.status(400).json({ message: 'Client ID and Service Type are required' });
    }

    const service = await Service.create({
      client,
      assignedAgent: req.user._id, // Automatically assign the logged-in agent
      serviceType,
      propertyDetails,
      notes
    });

    res.status(201).json(service);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all services for a specific client
// @route   GET /api/services/client/:clientId
// @access  Private
exports.getClientServices = async (req, res) => {
  try {
    // Find all services linked to this client ID
    // and populate the agent's name so we know who is handling it
    const services = await Service.find({ client: req.params.clientId })
      .populate('assignedAgent', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json(services);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update service status (e.g., from 'Initiated' to 'Completed')
// @route   PUT /api/services/:id
// @access  Private
exports.updateServiceStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true } // Returns the updated document
    );

    if (!service) return res.status(404).json({ message: 'Service not found' });

    res.status(200).json(service);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};