// backend/controllers/recordController.js
const Record = require('../models/Record');
const Entity = require('../models/Entity'); // <-- Added this so we can check the schema!
const { deleteFromCloudinary } = require('../config/cloudinary');
const Workspace = require('../models/Workspace'); // <-- ADD THIS LINE

// @desc    Create a new dynamic record (with optional media upload)
// @route   POST /api/records
// @access  Private
exports.createRecord = async (req, res) => {
  try {
    const { entityId, dynamicData } = req.body;
    let parsedData = typeof dynamicData === 'string' ? JSON.parse(dynamicData) : dynamicData;

    const entity = await Entity.findById(entityId);

    // --- NEW: THE SECURITY CHECK ---
    const workspace = await Workspace.findById(entity.workspace);
    const isOwner = workspace.owner.toString() === req.user._id.toString();
    const memberObj = workspace.members.find(m => m.user.toString() === req.user._id.toString());
    
    // If they aren't the owner, and they aren't an admin/editor, BLOCK THEM.
    if (!isOwner && (!memberObj || memberObj.role === 'viewer')) {
      return res.status(403).json({ message: 'Viewers cannot create records.' });
    }
    // -------------------------------

    // --- THE MULTI-FILE CLOUDINARY HANDLER ---
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        const fieldName = file.fieldname; // e.g., "House Photos"
        const fileUrl = file.secure_url || file.path;
        
        // Find out what kind of media column this is
        const fieldSchema = entity.fields.find(f => f.name === fieldName);
        
        if (fieldSchema) {
          if (fieldSchema.type === 'media-multiple') {
            // If it's multiple, save as an array of URLs
            if (!parsedData[fieldName]) parsedData[fieldName] = [];
            parsedData[fieldName].push(fileUrl);
          } else {
            // If it's single, save as a standard string URL
            parsedData[fieldName] = fileUrl;
          }
        }
      });
    }

    const newRecord = await Record.create({
      entity: entityId,
      createdBy: req.user._id,
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
    const records = await Record.find({ entity: req.params.entityId })
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
    const record = await Record.findById(req.params.id).populate('entity');
    
    if (!record) return res.status(404).json({ message: 'Record not found' });

    // --- SECURITY CHECK (THE BOUNCER) ---
    const workspace = await Workspace.findById(record.entity.workspace);
    const isOwner = workspace.owner.toString() === req.user._id.toString();
    const memberObj = workspace.members.find(m => m.user.toString() === req.user._id.toString());
    
    if (!isOwner && (!memberObj || memberObj.role === 'viewer')) {
      return res.status(403).json({ message: 'Viewers cannot edit records.' });
    }
    // ------------------------------------

    // Update the record data. We merge the old data with the new data.
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
exports.deleteRecord = async (req, res) => {
  try {
    const record = await Record.findById(req.params.id);

    // --- NEW: THE SECURITY CHECK ---
    const workspace = await Workspace.findById(record.entity.workspace);
    const isOwner = workspace.owner.toString() === req.user._id.toString();
    const memberObj = workspace.members.find(m => m.user.toString() === req.user._id.toString());
    
    // If they aren't the owner, and they aren't an admin/editor, BLOCK THEM.
    if (!isOwner && (!memberObj || memberObj.role === 'viewer')) {
      return res.status(403).json({ message: 'Viewers cannot delete records.' });
    }
    // -------------------------------

    if (!record) return res.status(404).json({ message: 'Record not found' });

    // --- CLOUDINARY CLEANUP LOGIC ---
    const fieldData = record.data || {};
    
    // Loop through every field in the record's data
    for (const key in fieldData) {
      const value = fieldData[key];

      // If it's a single URL string from Cloudinary
      if (typeof value === 'string' && value.includes('cloudinary.com')) {
        await deleteFromCloudinary(value);
      } 
      // If it's an array of URLs (media-multiple)
      else if (Array.isArray(value)) {
        for (const url of value) {
          if (typeof url === 'string' && url.includes('cloudinary.com')) {
            await deleteFromCloudinary(url);
          }
        }
      }
    }

    await record.deleteOne();
    res.status(200).json({ message: 'Record and associated media deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};