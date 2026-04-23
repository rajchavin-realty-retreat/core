const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  options: [{ type: String }], // Used for dropdowns
  
  targetEntity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: false },
  
  formula: { type: String, required: false },
  
  // --- NEW: CONDITIONAL FORMULA ENGINE ---
  dependentField: { type: String, required: false }, // Which dropdown does this rely on?
  conditions: [{
    value: String,   // E.g., "Tier 1"
    formula: String  // E.g., "{Salary} * 0.10"
  }]
});

const entitySchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  name: { type: String, required: true },
  fields: [fieldSchema]
}, { timestamps: true });

module.exports = mongoose.model('Entity', entitySchema);