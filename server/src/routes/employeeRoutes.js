const express = require('express');
const router = express.Router();
const { getEmployees, getEmployee, updateProfile } = require('../controllers/employeeController');
const authenticate = require('../middleware/auth');

router.get('/', authenticate, getEmployees);
router.get('/:id', authenticate, getEmployee);
router.put('/profile', authenticate, updateProfile);

module.exports = router;
