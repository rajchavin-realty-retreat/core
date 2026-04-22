const mongoose = require('mongoose');

// 1. Define what a "Role" actually looks like
const roleSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "Sales Rep", "Manager"
  
  // -- The Granular Permissions Engine --
  permissions: {
    // Record Viewing
    viewAllRecords: { type: Boolean, default: false },
    viewOwnRecords: { type: Boolean, default: true }, // Usually true if they are in the workspace
    
    // Record Creation
    createRecords: { type: Boolean, default: false },
    
    // Record Editing
    editAllRecords: { type: Boolean, default: false },
    editOwnRecords: { type: Boolean, default: false },
    
    // Record Deletion
    deleteAllRecords: { type: Boolean, default: false },
    deleteOwnRecords: { type: Boolean, default: false },
    
    // Admin Powers
    manageDatabases: { type: Boolean, default: false }, // Can create/delete schemas
    manageTeam: { type: Boolean, default: false }       // Can invite/kick members
  }
});

const workspaceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // 2. The Custom Roles stored in this workspace
  customRoles: [roleSchema],

  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
    
    // 3. We change 'role' from a strict string to an ID pointing to the customRoles array!
    // (If it's empty, we assume they are the owner)
    roleId: { type: mongoose.Schema.Types.ObjectId } 
  }],
}, { timestamps: true });

module.exports = mongoose.model('Workspace', workspaceSchema);