const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  icon: { type: String, default: '📦' },
  databases: [{
    tempId: String, // Used to track relations before the DB is actually created!
    name: String,
    fields: [{
      name: String,
      type: { type: String },
      isRequired: Boolean,
      options: [String], // For dropdowns
      targetTempId: String // For relations (points to another db's tempId in this template)
    }]
  }],
  createdBy: { type: String, required: true } // Stores the admin email
}, { timestamps: true });

module.exports = mongoose.model('Template', templateSchema);