const mongoose = require('mongoose');

const workspaceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['admin', 'editor', 'viewer'], default: 'editor' },
    // --- NEW: The Handshake Status ---
    status: { type: String, enum: ['pending', 'accepted'], default: 'pending' } 
  }]
}, { timestamps: true });

module.exports = mongoose.model('Workspace', workspaceSchema);