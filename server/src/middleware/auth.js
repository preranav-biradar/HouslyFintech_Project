const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { pool } = require('../config/db');

/**
 * JWT Authentication Middleware
 * Extracts JWT from HttpOnly cookie, verifies it, and attaches user to request
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from cookie or Authorization header
    let token = req.cookies?.token;

    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);

    // Fetch full user data from database
    const [users] = await pool.query(
      `SELECT u.id, u.employee_id, u.first_name, u.last_name, u.email, 
              u.phone, u.avatar_url, u.department_id, u.manager_id, 
              u.designation, u.is_active,
              r.name as role_name, r.hierarchy_level,
              d.name as department_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       JOIN departments d ON u.department_id = d.id
       WHERE u.id = ? AND u.is_active = TRUE`,
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found or account deactivated',
      });
    }

    // Attach user to request
    req.user = users[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please log in again.',
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token',
      });
    }
    next(error);
  }
};

module.exports = authenticate;
