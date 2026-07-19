const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { getEmployees, getEmployee, updateProfile } = require('../controllers/employeeController');
const authenticate = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

router.get('/', authenticate, getEmployees);
router.get('/:id', authenticate, getEmployee);
router.put('/profile', authenticate, upload.single('avatar'), updateProfile);

module.exports = router;
