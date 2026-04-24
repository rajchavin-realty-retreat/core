const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  options: [{ type: String }], 
  targetEntity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: false },
  formula: { type: String, required: false },
  dependentField: { type: String, required: false }, 
  conditions: [{ value: String, formula: String }],
  isRequired: { type: Boolean, default: false },
  isUnique: { type: Boolean, default: false },

  // --- PHASE B: RELATIONAL SUPERPOWERS ---
  
  // 1. Multi-Column Display (For Relations)
  displayFields: [{ type: String }], // Array of field names to display (e.g., ['First Name', 'Company'])
  
  // 2. Cascading/Dependent Filters (For Relations)
  cascadingParentField: { type: String }, // The local field this depends on (e.g., 'Service')
  cascadingTargetField: { type: String }, // The field in the target DB that must match (e.g., 'Parent Service')
  
  // 3. Lookups & Rollups
  sourceRelationField: { type: String }, // Which column in THIS table holds the Linked Record?
  targetLookupField: { type: String },   // Which column in the TARGET table are we pulling data from?
  rollupFunction: { type: String }       // 'SUM', 'AVERAGE', 'COUNT', 'MIN', 'MAX'
});

const entitySchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  name: { type: String, required: true },
  fields: [fieldSchema]
}, { timestamps: true });

module.exports = mongoose.model('Entity', entitySchema);