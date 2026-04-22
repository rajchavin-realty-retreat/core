const Workspace = require('../models/Workspace');
const User = require('../models/User');
const Entity = require('../models/Entity');
const Record = require('../models/Record');
const { deleteFromCloudinary } = require('../config/cloudinary');

// 1. Fetch workspaces where you are the Owner OR an invited Member
exports.getUserWorkspaces = async (req, res) => {
  try {
    const workspaces = await Workspace.find({
      $or: [
        { owner: req.user._id },
        { 'members.user': req.user._id }
      ]
    }).populate('owner', 'name email').populate('members.user', 'name email');
    
    res.status(200).json(workspaces);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. Create a brand new workspace
exports.createWorkspace = async (req, res) => {
  try {
    const { name } = req.body;
    const workspace = await Workspace.create({
      name,
      owner: req.user._id,
      members: [] // Starts empty
    });
    res.status(201).json(workspace);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. UPGRADED: Invite a colleague with a Custom Role ID
exports.inviteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Extract roleId from the frontend payload!
    const { email, roleId } = req.body; 

    const workspace = await Workspace.findById(id);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });
    
    // Only the owner can invite
    if (workspace.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can invite members' });
    }

    const userToInvite = await User.findOne({ email });
    if (!userToInvite) return res.status(404).json({ message: 'User not found with this email. They must sign up first!' });

    // Prevent adding the owner as a member
    if (workspace.owner.toString() === userToInvite._id.toString()) {
      return res.status(400).json({ message: 'You cannot invite yourself.' });
    }

    // Prevent duplicate invites
    const alreadyMember = workspace.members.some(m => m.user.toString() === userToInvite._id.toString());
    if (alreadyMember) return res.status(400).json({ message: 'User is already in this workspace.' });

    // Push the new member with their specific Custom Role ID
    workspace.members.push({
      user: userToInvite._id,
      status: 'pending',
      roleId: roleId
    });

    await workspace.save();

    res.status(200).json({ message: 'User invited successfully', workspace });
  } catch (error) {
    console.error("🔥 INVITE ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Accept or Decline a workspace invite
exports.respondToInvite = async (req, res) => {
  try {
    const { status } = req.body; // 'accepted' or 'declined'
    const workspace = await Workspace.findById(req.params.id);

    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    // Find this specific user in the members array
    const memberIndex = workspace.members.findIndex(m => m.user._id.toString() === req.user._id.toString());
    
    if (memberIndex === -1) {
      return res.status(403).json({ message: 'You do not have an invite to this workspace' });
    }

    if (status === 'accepted') {
      workspace.members[memberIndex].status = 'accepted';
      await workspace.save();
      res.status(200).json({ message: 'Invite accepted!' });
    } else if (status === 'declined') {
      // If declined, remove them from the workspace completely
      workspace.members.splice(memberIndex, 1);
      await workspace.save();
      res.status(200).json({ message: 'Invite declined.' });
    } else {
      res.status(400).json({ message: 'Invalid status' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Rename a workspace
// @route   PUT /api/workspaces/:id
exports.updateWorkspace = async (req, res) => {
  try {
    const { name } = req.body;
    const workspace = await Workspace.findById(req.params.id);

    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });
    
    // Only the owner can rename
    if (workspace.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can rename a workspace' });
    }

    workspace.name = name || workspace.name;
    await workspace.save();

    res.status(200).json(workspace);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a workspace and EVERYTHING inside it
// @route   DELETE /api/workspaces/:id
exports.deleteWorkspace = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    // Only the owner can nuke the workspace
    if (workspace.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can delete this workspace' });
    }

    // --- THE MASSIVE CASCADING WIPE ---
    // 1. Find all databases (entities) in this workspace
    const entities = await Entity.find({ workspace: workspace._id });

    // 2. Loop through every database
    for (const entity of entities) {
      // Find all records for this database
      const records = await Record.find({ entity: entity._id });
      
      // 3. Wipe all Cloudinary files attached to these records
      for (const record of records) {
        const fieldData = record.data || {};
        for (const key in fieldData) {
          const value = fieldData[key];
          if (typeof value === 'string' && value.includes('cloudinary.com')) {
            await deleteFromCloudinary(value);
          } else if (Array.isArray(value)) {
            for (const url of value) {
              if (typeof url === 'string' && url.includes('cloudinary.com')) await deleteFromCloudinary(url);
            }
          }
        }
      }
      
      // 4. Delete the records
      await Record.deleteMany({ entity: entity._id });
      
      // 5. Delete the database itself
      await entity.deleteOne();
    }

    // 6. Finally, delete the empty workspace
    await workspace.deleteOne();

    res.status(200).json({ message: 'Workspace and all associated data permanently deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- CUSTOM ROLE MANAGEMENT ---
exports.createCustomRole = async (req, res) => {
  try {
    const { id } = req.params;
    const roleData = req.body;
    const userId = req.user._id || req.user.id;

    const workspace = await Workspace.findById(id);
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });

    // Security check: Only the owner can create custom roles
    if (workspace.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only workspace owners can manage roles." });
    }

    // Push the new role into the array
    workspace.customRoles.push(roleData);
    await workspace.save();

    res.status(201).json({ message: "Role created successfully", workspace });
  } catch (error) {
    console.error("🔥 ROLE CREATION ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.deleteCustomRole = async (req, res) => {
  try {
    const { id, roleId } = req.params;
    const userId = req.user._id || req.user.id;

    const workspace = await Workspace.findById(id);
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });

    // Security check
    if (workspace.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only workspace owners can manage roles." });
    }

    // 1. Remove the role from the customRoles array
    workspace.customRoles = workspace.customRoles.filter(role => role._id.toString() !== roleId);

    // 2. Safety Sweep: If any team member had this role, revert them to a blank state
    workspace.members = workspace.members.map(member => {
      if (member.roleId && member.roleId.toString() === roleId) {
        member.roleId = null; 
      }
      return member;
    });

    await workspace.save();
    
    // 3. Send the updated workspace back to React so it can update the UI instantly
    res.status(200).json({ message: "Role deleted successfully", workspace });
  } catch (error) {
    console.error("🔥 ROLE DELETION ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};