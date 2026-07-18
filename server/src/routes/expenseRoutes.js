const express = require('express');
const router = express.Router();
const {
  createExpense, getExpenses, getExpenseSummary, updateExpense,
  deleteExpense, getPendingExpenses, getApprovedExpenses, getRejectedExpenses,
  approveExpense, rejectExpense, reimburseExpense,
} = require('../controllers/expenseController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { uploadReceipt } = require('../middleware/upload');

// Employee routes
router.post('/', authenticate, uploadReceipt.single('receipt'), createExpense);
router.get('/', authenticate, getExpenses);
router.get('/summary', authenticate, getExpenseSummary);
router.put('/:id', authenticate, uploadReceipt.single('receipt'), updateExpense);
router.delete('/:id', authenticate, deleteExpense);

// Manager routes
router.get('/pending', authenticate, authorize('super_admin', 'admin', 'manager'), getPendingExpenses);
router.get('/approved', authenticate, authorize('super_admin', 'admin', 'manager'), getApprovedExpenses);
router.get('/rejected', authenticate, authorize('super_admin', 'admin', 'manager'), getRejectedExpenses);
router.put('/:id/approve', authenticate, authorize('super_admin', 'admin', 'manager'), approveExpense);
router.put('/:id/reject', authenticate, authorize('super_admin', 'admin', 'manager'), rejectExpense);

// Admin routes
router.put('/:id/reimburse', authenticate, authorize('super_admin', 'admin'), reimburseExpense);

module.exports = router;
