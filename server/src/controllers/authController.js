const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { pool } = require('../config/db');

/**
 * POST /api/auth/login
 * Authenticate user with email and password
 */
const signup = async (req, res, next) => {
  try {
    const { first_name, last_name, email, password, phone } = req.body;

    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, email, and password are required',
      });
    }

    const [existingUsers] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered, please log in instead',
      });
    }

    const [roles] = await pool.query('SELECT id FROM roles WHERE name = ?', ['employee']);
    if (roles.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Employee role is not configured in the system',
      });
    }

    const [departments] = await pool.query('SELECT id FROM departments WHERE is_active = TRUE ORDER BY id LIMIT 1');
    if (departments.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'No active department found for new employee registration',
      });
    }

    const roleId = roles[0].id;
    const departmentId = departments[0].id;

    const [lastEmployee] = await pool.query('SELECT employee_id FROM users ORDER BY id DESC LIMIT 1');
    let employeeId = 'EMP-001';
    if (lastEmployee.length > 0) {
      const lastNum = parseInt(lastEmployee[0].employee_id.split('-')[1], 10);
      employeeId = `EMP-${String(lastNum + 1).padStart(3, '0')}`;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [result] = await pool.query(
      `INSERT INTO users (employee_id, first_name, last_name, email, password_hash, phone, role_id, department_id, designation, date_of_joining)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [employeeId, first_name, last_name, email, passwordHash, phone || null, roleId, departmentId, null, new Date().toISOString().split('T')[0]]
    );

    const currentYear = new Date().getFullYear();
    const [leaveTypes] = await pool.query('SELECT id, days_per_year FROM leave_types WHERE is_active = TRUE');
    for (const lt of leaveTypes) {
      await pool.query(
        `INSERT IGNORE INTO leave_balances (user_id, leave_type_id, year, total_days, remaining_days)
         VALUES (?, ?, ?, ?, ?)`,
        [result.insertId, lt.id, currentYear, lt.days_per_year, lt.days_per_year]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Signup successful. Please log in to continue.',
      data: { employee_id: employeeId },
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Find user by email
    const [users] = await pool.query(
      `SELECT u.*, r.name as role_name, r.hierarchy_level, d.name as department_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       JOIN departments d ON u.department_id = d.id
       WHERE u.email = ?`,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const user = users[0];

    // Check if account is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Contact an administrator.',
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, role: user.role_name },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    // Set HttpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Return user data (without password_hash)
    const { password_hash, ...userData } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userData,
        token, // Also send in body for clients that can't use cookies
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 * Clear JWT cookie
 */
const logout = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
};

/**
 * GET /api/auth/me
 * Get current authenticated user profile
 */
const getMe = async (req, res, next) => {
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.employee_id, u.first_name, u.last_name, u.email, 
              u.phone, u.avatar_url, u.department_id, u.manager_id,
              u.designation, u.date_of_joining, u.is_active,
              r.name as role_name, r.hierarchy_level,
              d.name as department_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       JOIN departments d ON u.department_id = d.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: users[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/auth/change-password
 * Change own password
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long',
      });
    }

    // Get current password hash
    const [users] = await pool.query(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user.id]
    );

    const isValid = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Hash new password and update
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await pool.query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newHash, req.user.id]
    );

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { signup, login, logout, getMe, changePassword };
