const express = require('express');
const router = express.Router();
const { login, signup, logout, getMe, changePassword, forgotPassword, resetPassword } = require('../controllers/authController');
const authenticate = require('../middleware/auth');

router.post('/login', login);
router.post('/signup', signup);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.put('/change-password', authenticate, changePassword);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
