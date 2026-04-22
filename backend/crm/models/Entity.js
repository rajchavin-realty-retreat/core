const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  options: [{ type: String }], // Used for dropdowns
  
  // THE NEW RELATION FIELD:
  targetEntity: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Entity',
    required: false // Important! It must be optional since text/number fields don't have it
  }
});

const entitySchema = new mongoose.Schema({
  workspace: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Workspace', 
    required: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  fields: [fieldSchema]
}, { timestamps: true });

module.exports = mongoose.model('Entity', entitySchema);