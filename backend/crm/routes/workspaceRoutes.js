const express = require('express');
const router = express.Router();
const { getUserWorkspaces, createWorkspace, inviteUser, respondToInvite, updateWorkspace, deleteWorkspace, createCustomRole, deleteCustomRole, getMemberStats } = require('../controllers/workspaceController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getUserWorkspaces);
router.post('/', protect, createWorkspace);
router.post('/:id/invite', protect, inviteUser);
router.put('/:id/invite/respond', protect, respondToInvite);
router.put('/:id', protect, updateWorkspace); 
router.delete('/:id', protect, deleteWorkspace);
router.post('/:id/roles', protect, createCustomRole);
router.delete('/:id/roles/:roleId', protect, deleteCustomRole); 
router.get('/:id/members/:memberId/stats', protect, getMemberStats); // <--- NEW ROUTE

module.exports = router;