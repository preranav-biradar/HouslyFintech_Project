const express = require('express');
const router = express.Router();
const { login, signup, logout, getMe, changePassword } = require('../controllers/authController');
const authenticate = require('../middleware/auth');

router.post('/login', login);
router.post('/signup', signup);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.put('/change-password', authenticate, changePassword);

module.exports = router;
