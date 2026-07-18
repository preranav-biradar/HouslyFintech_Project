const express = require('express');
const router = express.Router();
const {
  createLeaveRequest, getLeaves, getLeaveBalance,
  cancelLeave, getPendingLeaves, getApprovedLeaves, getRejectedLeaves,
  approveLeave, rejectLeave,
} = require('../controllers/leaveController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

// Employee routes
router.post('/', authenticate, createLeaveRequest);
router.get('/', authenticate, getLeaves);
router.get('/balance', authenticate, getLeaveBalance);
router.put('/:id/cancel', authenticate, cancelLeave);

// Manager/Admin routes
router.get('/pending', authenticate, authorize('super_admin', 'admin', 'manager'), getPendingLeaves);
router.get('/approved', authenticate, authorize('super_admin', 'admin', 'manager'), getApprovedLeaves);
router.get('/rejected', authenticate, authorize('super_admin', 'admin', 'manager'), getRejectedLeaves);
router.put('/:id/approve', authenticate, authorize('super_admin', 'admin', 'manager'), approveLeave);
router.put('/:id/reject', authenticate, authorize('super_admin', 'admin', 'manager'), rejectLeave);

module.exports = router;
