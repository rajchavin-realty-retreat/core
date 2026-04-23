const express = require('express');
const router = express.Router();
const { createEntity, getEntityById, getEntitiesByWorkspace, deleteEntity, updateEntity } = require('../controllers/entityController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createEntity);
router.get('/:id', protect, getEntityById);
router.get('/workspace/:workspaceId', protect, getEntitiesByWorkspace);
router.delete('/:id', protect, deleteEntity); // <-- Add this route
router.put('/:id', protect, updateEntity);
module.exports = router;