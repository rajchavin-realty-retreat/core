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
    const userId = req.user._id || req.user.id;
    
    // Explicitly extract ONLY the fields we trust from the frontend
    const { name, permissions, entityOverrides } = req.body;

    const workspace = await Workspace.findById(id);
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });

    // Security check: Only the owner can create custom roles
    if (workspace.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only workspace owners can manage roles." });
    }

    // Push the clean, structured role into the array
    workspace.customRoles.push({
      name,
      permissions,
      entityOverrides: entityOverrides || [] // Ensure it defaults to an empty array if none exist
    });
    
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

// ==========================================
// --- THE BACKEND FORMULA ENGINE ---
// ==========================================
const computeBackendFormula = (currentData, formulaString) => {
  if (!formulaString) return 0;
  let equation = formulaString;
  
  const variables = formulaString.match(/\{([^}]+)\}/g);
  if (variables) {
    variables.forEach(variable => {
      const colName = variable.replace(/[{}]/g, '');
      let val = currentData[colName];
      
      if (val === undefined || val === null || val === '') val = 0;
      else if (typeof val === 'string') {
        const stripped = val.replace(/[^0-9.-]+/g, ""); 
        val = stripped !== '' ? Number(stripped) : 0;
      } else {
        val = Number(val);
        if (isNaN(val)) val = 0;
      }
      // Globally replace all instances of the variable
      equation = equation.split(variable).join(val);
    });
  }

  try {
    const sanitizedEquation = equation.replace(/[^-()\d/*+.]/g, '');
    if (!sanitizedEquation) return 0;
    
    const result = new Function(`'use strict'; return (${sanitizedEquation})`)();
    if (!Number.isFinite(result) || Number.isNaN(result)) return 0;
    
    return Number(result.toFixed(2));
  } catch (e) {
    return 0;
  }
};

const getActiveFormula = (field, currentFormData) => {
  if (field.type === 'formula') return field.formula || '';
  if (field.type === 'conditional-formula') {
    const dependentValue = String(currentFormData[field.dependentField] || '').trim();
    const matchedCondition = field.conditions?.find(c => String(c.value).trim() === dependentValue);
    return matchedCondition ? (matchedCondition.formula || '') : '';
  }
  return '';
};


// ==========================================
// --- MEMBER ANALYTICS ENGINE ---
// ==========================================
// @desc    Calculate total contributions and numeric sums across all databases
// @route   GET /api/workspaces/:id/members/:memberId/stats
exports.getMemberStats = async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const userId = req.user._id || req.user.id;

    const workspace = await Workspace.findById(id);
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });

    // 1. Security Check
    const isOwner = workspace.owner.toString() === userId.toString();
    const myMember = workspace.members.find(m => m.user.toString() === userId.toString());

    const isRequestingOwnStats = userId.toString() === memberId.toString();
    
    let canViewStats = isOwner;

    if (!isOwner && myMember && workspace.customRoles) {
      const myRole = workspace.customRoles.find(r => r._id.toString() === myMember.roleId?.toString());
      if (myRole && myRole.permissions.manageTeam) canViewStats = true;
    }

    if (!canViewStats) {
      return res.status(403).json({ message: "Security Error: You do not have permission to view team analytics." });
    }

    // 2. Fetch all databases
    const entities = await Entity.find({ workspace: workspace._id });
    
    // 3. Create a map tracking the FULL SCHEMA of numeric fields
    const entityMap = {};
    entities.forEach(ent => {
      // We grab the full field object so we have access to the formula strings!
      const numericFields = ent.fields.filter(f => ['number', 'formula', 'conditional-formula'].includes(f.type));

      entityMap[ent._id.toString()] = { 
        name: ent.name, 
        numericFields, 
        recordCount: 0, 
        sums: {} 
      };

      // Initialize sums to 0
      numericFields.forEach(f => entityMap[ent._id.toString()].sums[f.name] = 0);
    });

    // 4. Fetch ALL records
    const entityIds = entities.map(e => e._id);
    const records = await Record.find({ 
      entity: { $in: entityIds }, 
      createdBy: memberId 
    });

    // 5. The High-Speed Calculation Engine
    let globalRecordCount = 0;
    let globalSum = 0;

    records.forEach(rec => {
      const entId = rec.entity.toString();
      if (entityMap[entId]) {
        entityMap[entId].recordCount++;
        globalRecordCount++;

        // We clone the row data so we can calculate formulas on the fly
        const rowData = { ...rec.data };

        // First Pass: Auto-calculate all formulas just in case the DB is outdated
        entityMap[entId].numericFields.forEach(field => {
          if (field.type === 'formula' || field.type === 'conditional-formula') {
             rowData[field.name] = computeBackendFormula(rowData, getActiveFormula(field, rowData));
          }
        });

        // Second Pass: Add them all up!
        entityMap[entId].numericFields.forEach(field => {
          const val = Number(rowData[field.name]) || 0;
          entityMap[entId].sums[field.name] += val;
          globalSum += val; 
        });
      }
    });

    const databaseStats = Object.values(entityMap).filter(stat => stat.recordCount > 0);

    res.status(200).json({
      globalRecordCount,
      globalSum,
      databaseStats
    });

  } catch (error) {
    console.error("🔥 MEMBER STATS ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Remove a member from a workspace
// @route   DELETE /api/workspaces/:id/members/:memberId
// @access  Private
exports.removeMember = async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const targetMemberId = req.params.memberId;
    const requestUserId = req.user._id || req.user.id;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    // 1. Security Check: Is the person requesting the deletion an Owner or Admin?
    const isOwner = workspace.owner.toString() === requestUserId.toString();
    
    if (!isOwner) {
      const myMembership = workspace.members.find(m => m.user.toString() === requestUserId.toString());
      if (!myMembership) return res.status(403).json({ message: 'You are not in this workspace.' });

      const myRole = workspace.customRoles.find(r => r._id.toString() === myMembership.roleId?.toString());
      if (!myRole || !myRole.permissions.manageTeam) {
        return res.status(403).json({ message: 'Security Error: You do not have permission to remove members.' });
      }
    }

    // 2. Prevent accidentally deleting the workspace owner
    if (workspace.owner.toString() === targetMemberId) {
      return res.status(400).json({ message: 'You cannot remove the Workspace Owner.' });
    }

    // 3. Remove the member from the array
    const initialMemberCount = workspace.members.length;
    workspace.members = workspace.members.filter(m => m.user.toString() !== targetMemberId.toString());

    if (workspace.members.length === initialMemberCount) {
      return res.status(404).json({ message: 'Member not found in this workspace.' });
    }

    // 4. Save the updated workspace
    await workspace.save();
    
    res.status(200).json({ message: 'Member successfully removed.' });

  } catch (error) {
    console.error("Remove Member Error:", error);
    res.status(500).json({ message: error.message });
  }
};