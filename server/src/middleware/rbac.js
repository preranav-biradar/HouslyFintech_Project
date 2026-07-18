const { pool } = require('../config/db');

/**
 * Role-Based Access Control Middleware
 * Checks if the authenticated user has one of the allowed roles.
 * @param  {...string} allowedRoles - Role names that can access the route
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(req.user.role_name)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action',
      });
    }

    next();
  };
};

/**
 * Check if the current user is the manager of the target user
 * or has a higher hierarchy level (admin/super_admin)
 */
const authorizeManagerOf = async (req, res, next) => {
  try {
    const targetUserId = parseInt(req.params.userId || req.body.userId);

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID is required',
      });
    }

    // Admin can access everything
    if (req.user.role_name === 'admin') {
      return next();
    }

    // Users are not allowed to manage other users
    if (req.user.role_name === 'user') {
      const [users] = await pool.query(
        'SELECT id FROM users WHERE manager_id = ? AND id = ?',
        [req.user.id, targetUserId]
      );

      if (users.length > 0) {
        return next();
      }
    }

    // Users can access their own data
    if (req.user.id === targetUserId) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'You do not have permission to access this user\'s data',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if the current user can manage users in a specific department
 * Admins/Super admins can manage all departments
 * Managers can only manage their own department
 */
const authorizeDepartment = async (req, res, next) => {
  try {
    const departmentId = parseInt(req.params.departmentId || req.body.department_id || req.query.department_id);

    // Super admin and admin can access all departments
    if (['super_admin', 'admin'].includes(req.user.role_name)) {
      return next();
    }

    // Managers can only access their own department
    if (req.user.role_name === 'manager' && req.user.department_id === departmentId) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'You do not have permission to manage this department',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { authorize, authorizeManagerOf, authorizeDepartment };
