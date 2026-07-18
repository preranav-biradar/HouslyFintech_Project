const express = require('express');
const router = express.Router();
const { checkIn, checkOut, getToday, getHistory, getReport } = require('../controllers/attendanceController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { uploadSelfie } = require('../middleware/upload');

// Employee routes
router.post('/check-in', authenticate, uploadSelfie.single('selfie'), checkIn);
router.post('/check-out', authenticate, uploadSelfie.single('selfie'), checkOut);
router.get('/today', authenticate, getToday);
router.get('/history', authenticate, getHistory);

// Manager/Admin routes
router.get('/report', authenticate, authorize('super_admin', 'admin', 'manager'), getReport);

module.exports = router;
