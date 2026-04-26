// backend/models/Record.js
const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema({
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Add this inside your existing RecordSchema
  comments: [{
    text: String,
    userName: String,
    createdAt: { type: Date, default: Date.now }
  }],
  // Mongoose 'Mixed' type allows us to save dynamic, unstructured JSON!
  data: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });

// Tell Mongoose that the 'data' field might change in unpredictable ways
// Modern Mongoose handles the lifecycle automatically, no 'next' needed
recordSchema.pre('save', function() {
  this.markModified('data');
});

module.exports = mongoose.model('Record', recordSchema);