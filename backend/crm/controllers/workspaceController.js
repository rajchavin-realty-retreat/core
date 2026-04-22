const Workspace = require('../models/Workspace');
const User = require('../models/User');
const Entity = require('../models/Entity'); // <-- Add this
const Record = require('../models/Record'); // <-- Add this
const { deleteFromCloudinary } = require('../config/cloudinary'); // <-- Add this

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

// 3. Invite a colleague to your workspace
exports.addMember = async (req, res) => {
  try {
    const { email, role } = req.body;
    const workspace = await Workspace.findById(req.params.id);

    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });
    
    // Only the owner can invite
    if (workspace.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can invite members' });
    }

    // Find the user they are inviting
    const userToAdd = await User.findOne({ email });
    if (!userToAdd) return res.status(404).json({ message: 'User not found. They must sign up first!' });

    // Prevent adding the owner as a member
    if (workspace.owner.toString() === userToAdd._id.toString()) {
      return res.status(400).json({ message: 'You cannot invite yourself.' });
    }

    // Prevent duplicate invites
    const isMember = workspace.members.some(m => m.user.toString() === userToAdd._id.toString());
    if (isMember) return res.status(400).json({ message: 'User is already in this workspace.' });

    // Add them to the array and save
    workspace.members.push({ user: userToAdd._id, role: role || 'editor' });
    await workspace.save();

    res.status(200).json({ message: 'Team member added successfully!' });
  } catch (error) {
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