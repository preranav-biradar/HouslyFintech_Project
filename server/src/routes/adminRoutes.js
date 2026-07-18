const express = require('express');
const router = express.Router();
const {
  createEmployee, updateEmployee, deleteEmployee, resetPassword,
  getDashboardStats,
  getDepartments, createDepartment, updateDepartment,
  getOfficeLocations, createOfficeLocation, updateOfficeLocation,
  getRoles, getLeaveTypes, getExpenseCategories,
  getNotifications, markNotificationRead
} = require('../controllers/adminController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

// All admin routes require at least admin privileges, except notifications which are user-specific
// but we put notification endpoints here as requested by the plan.
// Actually notifications are for all users, but placed in admin controller. Let's adjust auth.

// Dashboard stats
router.get('/dashboard', authenticate, authorize('super_admin', 'admin', 'manager'), getDashboardStats);

// Employees
router.post('/employees', authenticate, authorize('super_admin', 'admin'), createEmployee);
router.put('/employees/:id', authenticate, authorize('super_admin', 'admin'), updateEmployee);
router.delete('/employees/:id', authenticate, authorize('super_admin', 'admin'), deleteEmployee);
router.post('/employees/:id/reset-password', authenticate, authorize('super_admin', 'admin'), resetPassword);

// Departments
router.get('/departments', authenticate, getDepartments);
router.post('/departments', authenticate, authorize('super_admin', 'admin'), createDepartment);
router.put('/departments/:id', authenticate, authorize('super_admin', 'admin'), updateDepartment);

// Office Locations
router.get('/office-locations', authenticate, getOfficeLocations);
router.post('/office-locations', authenticate, authorize('super_admin', 'admin'), createOfficeLocation);
router.put('/office-locations/:id', authenticate, authorize('super_admin', 'admin'), updateOfficeLocation);

// Lookups
router.get('/roles', authenticate, getRoles);
router.get('/leave-types', authenticate, getLeaveTypes);
router.get('/expense-categories', authenticate, getExpenseCategories);

// Notifications (For current user)
router.get('/notifications', authenticate, getNotifications);
router.put('/notifications/:id/read', authenticate, markNotificationRead);

module.exports = router;
