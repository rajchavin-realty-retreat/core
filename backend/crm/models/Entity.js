const mongoose = require('mongoose');

const entitySchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  name: { type: String, required: true },
  fields: [{
    name: { type: String, required: true },
    type: { 
      type: String, 
      // Look at all these new data types!
      enum: ['text', 'textarea', 'number', 'date', 'datetime', 'dropdown', 'checkbox', 'media', 'media-multiple'], 
      required: true 
    },
    // If the type is 'dropdown', this stores the comma-separated choices
    options: [{ type: String }] 
  }]
}, { timestamps: true });

module.exports = mongoose.model('Entity', entitySchema);