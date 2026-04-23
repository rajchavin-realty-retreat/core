// backend/controllers/recordController.js
const Record = require('../models/Record');
const Entity = require('../models/Entity'); 
const Workspace = require('../models/Workspace'); 
const { deleteFromCloudinary } = require('../config/cloudinary');
const cloudinary = require('cloudinary').v2; // We need this to check file sizes

// --- THE PERMISSION ENGINE (Helper Function) ---
const getUserPermissions = async (workspaceId, userId) => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new Error("Workspace not found");

  // 1. If they are the owner, give them God mode.
  if (workspace.owner.toString() === userId.toString()) {
    return {
      viewAllRecords: true, viewOwnRecords: true, createRecords: true,
      editAllRecords: true, editOwnRecords: true, deleteAllRecords: true, deleteOwnRecords: true
    };
  }

  // 2. Find their assigned Custom Role
  const member = workspace.members.find(m => m.user.toString() === userId.toString());
  if (!member || member.status !== 'accepted') throw new Error("Not a valid workspace member");

  const userRole = workspace.customRoles.find(r => r._id.toString() === member.roleId?.toString());
  
  // 3. If they don't have a role, give them strict View-Only basics
  if (!userRole) {
    return {
      viewAllRecords: false, viewOwnRecords: true, createRecords: false,
      editAllRecords: false, editOwnRecords: false, deleteAllRecords: false, deleteOwnRecords: false
    };
  }

  return userRole.permissions;
};

// @desc    Create a new dynamic record (with optional media upload)
// @route   POST /api/records
// @access  Private
exports.createRecord = async (req, res) => {
  try {
    const { entityId, dynamicData } = req.body;
    let parsedData = typeof dynamicData === 'string' ? JSON.parse(dynamicData) : dynamicData;
    const userId = req.user._id || req.user.id;

    const entity = await Entity.findById(entityId);
    if (!entity) return res.status(404).json({ message: "Database not found" });

    // --- PHASE 3 SECURITY CHECK ---
    const workspaceId = entity.workspace || entity.workspaceId;
    const permissions = await getUserPermissions(workspaceId, userId);

    if (!permissions.createRecords) {
      return res.status(403).json({ message: 'Security Error: You do not have permission to create records.' });
    }
    // -------------------------------

    // --- THE MULTI-FILE CLOUDINARY HANDLER ---
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        const fieldName = file.fieldname; 
        const fileUrl = file.secure_url || file.path;
        
        const fieldSchema = entity.fields.find(f => f.name === fieldName);
        
        if (fieldSchema) {
          if (fieldSchema.type === 'media-multiple') {
            if (!parsedData[fieldName]) parsedData[fieldName] = [];
            parsedData[fieldName].push(fileUrl);
          } else {
            parsedData[fieldName] = fileUrl;
          }
        }
      });
    }

    const newRecord = await Record.create({
      entity: entityId,
      createdBy: userId,
      data: parsedData
    });

    res.status(201).json(newRecord);
  } catch (error) {
    console.error("RECORD CREATION ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all data rows for a specific custom CRM
// @route   GET /api/records/entity/:entityId
// @access  Private
exports.getRecordsByEntity = async (req, res) => {
  try {
    const { entityId } = req.params;
    const userId = req.user._id || req.user.id;

    const entity = await Entity.findById(entityId);
    if (!entity) return res.status(404).json({ message: "Database not found" });

    // --- PHASE 3 SECURITY CHECK ---
    const workspaceId = entity.workspace || entity.workspaceId;
    const permissions = await getUserPermissions(workspaceId, userId);

    let query = { entity: entity._id };
    
    if (!permissions.viewAllRecords) {
      if (!permissions.viewOwnRecords) {
        return res.status(403).json({ message: "Access Denied: You do not have permission to view records." });
      }
      query.createdBy = userId; // Force the query to only return their records!
    }
    // -------------------------------

    const records = await Record.find(query)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
      
    res.status(200).json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update an existing record
// @route   PUT /api/records/:id
// @access  Private
exports.updateRecord = async (req, res) => {
  try {
    const { dynamicData } = req.body;
    const userId = req.user._id || req.user.id;

    const record = await Record.findById(req.params.id).populate('entity');
    if (!record) return res.status(404).json({ message: 'Record not found' });

    // --- PHASE 3 SECURITY CHECK ---
    const workspaceId = record.entity.workspace || record.entity.workspaceId;
    const permissions = await getUserPermissions(workspaceId, userId);

    const isOwnerOfRecord = record.createdBy.toString() === userId.toString();
    
    if (!permissions.editAllRecords) {
      if (!permissions.editOwnRecords || !isOwnerOfRecord) {
        return res.status(403).json({ message: "Security Error: You do not have permission to edit this record." });
      }
    }
    // ------------------------------------

    record.data = { ...record.data, ...dynamicData };
    
    await record.save();
    res.status(200).json({ message: 'Record updated successfully', record });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a specific record and its associated cloud files
// @route   DELETE /api/records/:id
// @access  Private
// --- UPGRADED: DELETION + STORAGE RECOVERY ---
exports.deleteRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;

    const record = await Record.findById(id).populate('entity');
    if (!record) return res.status(404).json({ message: "Record not found" });

    const workspaceId = record.entity.workspace || record.entity.workspaceId;
    const permissions = await getUserPermissions(workspaceId, userId);
    const isOwnerOfRecord = record.createdBy.toString() === userId.toString();
    
    if (!permissions.deleteAllRecords) {
      if (!permissions.deleteOwnRecords || !isOwnerOfRecord) return res.status(403).json({ message: "Security Error: You do not have permission to delete this record." });
    }

    // 1. CLOUDINARY STORAGE RECOVERY ENGINE
    let bytesRecovered = 0;
    const fieldData = record.data || {};

    const processDeletion = async (url) => {
      if (typeof url === 'string' && url.includes('cloudinary.com')) {
        try {
          const publicId = url.split('/').slice(-2).join('/').split('.')[0]; 
          // Fetch the file size before we delete it
          const fileDetails = await cloudinary.api.resource(publicId);
          bytesRecovered += fileDetails.bytes;
          // Nuke it from Cloudinary
          await cloudinary.uploader.destroy(publicId, { invalidate: true });
        } catch(e) { console.log("File already gone or not found in Cloudinary") }
      }
    };

    for (const key in fieldData) {
      const value = fieldData[key];
      if (typeof value === 'string') {
        await processDeletion(value);
      } else if (Array.isArray(value)) {
        for (const url of value) await processDeletion(url);
      }
    }

    // 2. Refund the storage back to the Workspace!
    if (bytesRecovered > 0) {
      await Workspace.findByIdAndUpdate(workspaceId, {
        $inc: { storageUsed: -bytesRecovered } 
      });
    }

    await Record.findByIdAndDelete(id);
    res.status(200).json({ message: "Record securely deleted and storage recovered" });
  } catch (error) { res.status(500).json({ message: error.message }); }
};