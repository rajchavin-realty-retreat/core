// backend/models/Service.js
const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  // The link to the Client
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  
  // The link to the Rajchavin Employee handling this specific service
  assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  serviceType: { 
    type: String, 
    enum: ['Property Buying', 'Property Selling', 'Legal/Consultation', 'Property Management', 'Interior Design'],
    required: true
  },
  
  status: {
    type: String,
    enum: ['Initiated', 'In Progress', 'On Hold', 'Completed', 'Cancelled'],
    default: 'Initiated'
  },
  
  propertyDetails: { type: String }, // e.g., "3BHK in Indiranagar"
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);