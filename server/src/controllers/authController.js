const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { pool } = require('../config/db');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

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

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const [users] = await pool.query('SELECT id, first_name FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      // Return success even if not found to prevent email enumeration
      return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    }

    const user = users[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = await bcrypt.hash(resetToken, 10);
    
    await pool.query(
      'UPDATE users SET reset_token = ?, reset_token_expires = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id = ?',
      [resetTokenHash, user.id]
    );

    // Generate Reset Link
    const resetLink = `${req.protocol}://${req.get('host') === 'localhost:5000' ? 'localhost:5173' : req.get('host')}/reset-password/${resetToken}?email=${encodeURIComponent(email)}`;
    
    // Set up Nodemailer Transport
    let transporter;
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else {
      // Fallback to Ethereal Mail for testing without SMTP credentials
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }

    // Send the email
    const info = await transporter.sendMail({
      from: '"Hously EMS Support" <noreply@hously-ems.com>',
      to: email,
      subject: "Password Reset Request - Hously EMS",
      text: `Hi ${user.first_name},\n\nYou requested a password reset. Click the link below to set a new password:\n\n${resetLink}\n\nIf you did not request this, please ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
            <h2 style="color: #3b82f6;">Hously EMS</h2>
            <p>Hi ${user.first_name},</p>
            <p>You recently requested to reset your password for your Hously EMS account. Click the button below to reset it:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
            </div>
            <p style="color: #64748b; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
      `
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log("Email Preview URL: %s", previewUrl);
    }

    res.json({
      success: true,
      message: 'A password reset link has been sent to your email inbox.',
      previewUrl: previewUrl || null
    });

  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const [users] = await pool.query(
      'SELECT id, reset_token, reset_token_expires FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    const user = users[0];

    // Check expiry
    if (!user.reset_token_expires || new Date(user.reset_token_expires) < new Date()) {
      return res.status(400).json({ success: false, message: 'Reset token has expired' });
    }

    // Check token validity
    const isValidToken = await bcrypt.compare(token, user.reset_token || '');
    if (!isValidToken) {
      return res.status(400).json({ success: false, message: 'Invalid reset token' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    // Update password and clear reset tokens
    await pool.query(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [newHash, user.id]
    );

    res.json({ success: true, message: 'Password has been successfully reset. You can now log in.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { signup, login, logout, getMe, changePassword, forgotPassword, resetPassword };
