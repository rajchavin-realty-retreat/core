// backend/controllers/recordController.js
const Record = require('../models/Record');
const Entity = require('../models/Entity'); 
const Workspace = require('../models/Workspace'); 
const { deleteFromCloudinary } = require('../config/cloudinary');
const cloudinary = require('cloudinary').v2; 

// --- PHASE C: THE GRANULAR PERMISSION ENGINE ---
const getUserPermissions = async (workspaceId, userId, entityId = null) => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new Error("Workspace not found");

  // Owners get God Mode
  if (workspace.owner.toString() === userId.toString()) {
    return {
      viewAllRecords: true, viewOwnRecords: true, createRecords: true,
      editAllRecords: true, editOwnRecords: true, deleteAllRecords: true, deleteOwnRecords: true
    };
  }

  const member = workspace.members.find(m => m.user.toString() === userId.toString());
  if (!member || member.status !== 'accepted') throw new Error("Not a valid workspace member");

  const userRole = workspace.customRoles.find(r => r._id.toString() === member.roleId?.toString());
  
  if (!userRole) {
    return {
      viewAllRecords: false, viewOwnRecords: true, createRecords: false,
      editAllRecords: false, editOwnRecords: false, deleteAllRecords: false, deleteOwnRecords: false
    };
  }

  let finalPermissions = { ...userRole.permissions };

  // --- THE OVERRIDE CHECKER ---
  // If we are checking a specific database, look for granular overrides!
  if (entityId && userRole.entityOverrides && userRole.entityOverrides.length > 0) {
    const override = userRole.entityOverrides.find(eo => eo.entityId.toString() === entityId.toString());
    if (override) {
      // Merge the database-specific rules on top of the global rules
      finalPermissions = { ...finalPermissions, ...override.permissions };
    }
  }

  return finalPermissions;
};

// --- THE ENTERPRISE VALIDATION ENGINE ---
const validateRecordData = async (entityId, incomingData, recordIdToExclude = null) => {
  const entity = await Entity.findById(entityId);
  if (!entity) throw new Error("Database schema not found.");

  for (let field of entity.fields) {
    const value = incomingData[field.name];
    if (field.isRequired) {
      if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0)) {
        throw new Error(`Validation Error: "${field.name}" is a required field.`);
      }
    }
    if (field.isUnique && value !== undefined && value !== null && String(value).trim() !== '') {
      const query = { entity: entityId, [`data.${field.name}`]: value };
      if (recordIdToExclude) query._id = { $ne: recordIdToExclude }; 
      const existingRecord = await Record.findOne(query);
      if (existingRecord) throw new Error(`Duplicate Error: The value "${value}" already exists in the "${field.name}" column.`);
    }
  }
};


exports.createRecord = async (req, res) => {
  try {
    const { entityId, dynamicData } = req.body;
    let parsedData = typeof dynamicData === 'string' ? JSON.parse(dynamicData) : dynamicData;
    const userId = req.user._id || req.user.id;

    const entity = await Entity.findById(entityId);
    if (!entity) return res.status(404).json({ message: "Database not found" });

    // Pass entityId to check for granular permissions
    const workspaceId = entity.workspace || entity.workspaceId;
    const permissions = await getUserPermissions(workspaceId, userId, entityId);

    if (!permissions.createRecords) return res.status(403).json({ message: 'Security Error: You do not have permission to create records in this database.' });

    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        const fieldName = file.fieldname; 
        const fileUrl = file.secure_url || file.path;
        const fieldSchema = entity.fields.find(f => f.name === fieldName);
        if (fieldSchema) {
          if (fieldSchema.type === 'media-multiple') {
            if (!parsedData[fieldName]) parsedData[fieldName] = [];
            parsedData[fieldName].push(fileUrl);
          } else parsedData[fieldName] = fileUrl;
        }
      });
    }

    await validateRecordData(entityId, parsedData);

    const newRecord = await Record.create({ entity: entityId, createdBy: userId, data: parsedData });
    res.status(201).json(newRecord);
  } catch (error) { res.status(400).json({ message: error.message }); }
};


exports.getRecordsByEntity = async (req, res) => {
  try {
    const { entityId } = req.params;
    const userId = req.user._id || req.user.id;

    const entity = await Entity.findById(entityId);
    if (!entity) return res.status(404).json({ message: "Database not found" });

    const workspaceId = entity.workspace || entity.workspaceId;
    const permissions = await getUserPermissions(workspaceId, userId, entityId);

    let query = { entity: entity._id };
    if (!permissions.viewAllRecords) {
      if (!permissions.viewOwnRecords) return res.status(403).json({ message: "Access Denied." });
      query.createdBy = userId; 
    }

    const records = await Record.find(query).populate('createdBy', 'name').sort({ createdAt: -1 });
    res.status(200).json(records);
  } catch (error) { res.status(500).json({ message: error.message }); }
};


exports.updateRecord = async (req, res) => {
  try {
    const { dynamicData } = req.body;
    const userId = req.user._id || req.user.id;

    const record = await Record.findById(req.params.id).populate('entity');
    if (!record) return res.status(404).json({ message: 'Record not found' });

    const workspaceId = record.entity.workspace || record.entity.workspaceId;
    const permissions = await getUserPermissions(workspaceId, userId, record.entity._id);
    const isOwnerOfRecord = record.createdBy.toString() === userId.toString();
    
    if (!permissions.editAllRecords) {
      if (!permissions.editOwnRecords || !isOwnerOfRecord) return res.status(403).json({ message: "Security Error: You do not have permission to edit this record." });
    }

    const mergedData = { ...record.data, ...dynamicData };
    await validateRecordData(record.entity._id || record.entity, mergedData, record._id);

    record.data = mergedData;
    await record.save();
    res.status(200).json({ message: 'Record updated successfully', record });
  } catch (error) { res.status(400).json({ message: error.message }); }
};


exports.deleteRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;

    const record = await Record.findById(id).populate('entity');
    if (!record) return res.status(404).json({ message: "Record not found" });

    const workspaceId = record.entity.workspace || record.entity.workspaceId;
    const permissions = await getUserPermissions(workspaceId, userId, record.entity._id);
    const isOwnerOfRecord = record.createdBy.toString() === userId.toString();
    
    if (!permissions.deleteAllRecords) {
      if (!permissions.deleteOwnRecords || !isOwnerOfRecord) return res.status(403).json({ message: "Security Error: You do not have permission to delete this record." });
    }

    let bytesRecovered = 0;
    const processDeletion = async (url) => {
      if (typeof url === 'string' && url.includes('cloudinary.com')) {
        try {
          const publicId = url.split('/').slice(-2).join('/').split('.')[0]; 
          const fileDetails = await cloudinary.api.resource(publicId);
          bytesRecovered += fileDetails.bytes;
          await cloudinary.uploader.destroy(publicId, { invalidate: true });
        } catch(e) {}
      }
    };

    for (const key in record.data || {}) {
      const value = (record.data || {})[key];
      if (typeof value === 'string') await processDeletion(value);
      else if (Array.isArray(value)) for (const url of value) await processDeletion(url);
    }

    if (bytesRecovered > 0) await Workspace.findByIdAndUpdate(workspaceId, { $inc: { storageUsed: -bytesRecovered } });

    await Record.findByIdAndDelete(id);
    res.status(200).json({ message: "Record securely deleted" });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

// Add Comment to Record
exports.addComment = async (req, res) => {
  try {
    const record = await Record.findById(req.params.id);
    
    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }
    
    // Push the new comment into the array
    record.comments.push({
      text: req.body.text,
      userName: req.body.userName
    });
    
    await record.save();
    
    // Return the updated record back to the frontend
    res.status(201).json(record);
    
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ message: 'Server error adding comment' });
  }
};