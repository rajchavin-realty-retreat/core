const express = require('express');
const router = express.Router();
const { getUserWorkspaces, createWorkspace, addMember, respondToInvite, updateWorkspace, deleteWorkspace } = require('../controllers/workspaceController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getUserWorkspaces);
router.post('/', protect, createWorkspace);
router.post('/:id/invite', protect, addMember); // The new invite route
router.put('/:id/invite/respond', protect, respondToInvite); // <-- Add this route
router.put('/:id', protect, updateWorkspace); 
router.delete('/:id', protect, deleteWorkspace);

module.exports = router;