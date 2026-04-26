const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String, default: 'Inbox' }, // Matches a column in Workspace.taskColumns
  
  // --- THE NEW ASSIGNMENT ENGINE ---
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // --- CRM LINKING ---
  linkedEntityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity' }, // e.g., "Customers" DB
  linkedRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'Record' }  // e.g., "Acme Corp" Record
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);