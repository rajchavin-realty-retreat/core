// backend/controllers/entityController.js
const Entity = require('../models/Entity');
const Record = require('../models/Record');
const Workspace = require('../models/Workspace');
const { deleteFromCloudinary } = require('../config/cloudinary');

// @desc    Create a new custom CRM (Entity)
// @route   POST /api/entities
// @access  Private
exports.createEntity = async (req, res) => {
  try {
    const { workspaceId, name, fields } = req.body;
    
    const entity = await Entity.create({
      workspace: workspaceId,
      name,
      fields // e.g., [{ name: "Budget", type: "number" }]
    });

    res.status(201).json(entity);
  } catch (error) {
    console.error("🔥 ENTITY CREATION ERROR:", error); 
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get the schema for a specific CRM (Used by DynamicForm & DynamicTable)
// @route   GET /api/entities/:id
// @access  Private
exports.getEntityById = async (req, res) => {
  try {
    const entity = await Entity.findById(req.params.id);
    if (!entity) return res.status(404).json({ message: 'Entity not found' });
    res.status(200).json(entity);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all entities for a specific workspace
// @route   GET /api/entities/workspace/:workspaceId
// @access  Private
exports.getEntitiesByWorkspace = async (req, res) => {
  try {
    const entities = await Entity.find({ workspace: req.params.workspaceId });
    res.status(200).json(entities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a database (entity) and all its records
// @route   DELETE /api/entities/:id
// @access  Private
exports.deleteEntity = async (req, res) => {
  try {
    const entity = await Entity.findById(req.params.id);
    if (!entity) return res.status(404).json({ message: 'Database not found' });

    // --- SECURITY BOUNCER ---
    const workspace = await Workspace.findById(entity.workspace);
    const isOwner = workspace.owner.toString() === req.user._id.toString();
    const memberObj = workspace.members.find(m => m.user.toString() === req.user._id.toString());
    
    // Only Owners and Admins can delete entire databases
    if (!isOwner && (!memberObj || memberObj.role !== 'admin')) {
      return res.status(403).json({ message: 'Only Owners or Admins can delete databases.' });
    }

    // --- CASCADING WIPE ---
    // 1. Find all records belonging to this database
    const records = await Record.find({ entity: entity._id });

    // 2. Loop through and wipe Cloudinary files
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

    // 3. Delete all the records
    await Record.deleteMany({ entity: entity._id });

    // 4. Delete the database itself
    await entity.deleteOne();

    res.status(200).json({ message: 'Database and all associated records permanently deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update an existing database schema
// @route   PUT /api/entities/:id
exports.updateEntity = async (req, res) => {
  try {
    const { name, fields } = req.body;
    const entity = await Entity.findById(req.params.id);
    
    if (!entity) return res.status(404).json({ message: "Database not found" });

    // Update the schema blueprint
    entity.name = name || entity.name;
    entity.fields = fields || entity.fields;
    
    await entity.save();
    res.status(200).json({ message: "Database schema updated successfully", entity });
  } catch (error) { 
    res.status(500).json({ message: error.message }); 
  }
};