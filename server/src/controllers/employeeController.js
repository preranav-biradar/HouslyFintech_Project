const { pool } = require('../config/db');

/**
 * GET /api/employees
 * List employees with role-based filtering
 */
const getEmployees = async (req, res, next) => {
  try {
    const { department_id, role, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT u.id, u.employee_id, u.first_name, u.last_name, u.email,
             u.phone, u.avatar_url, u.designation, u.date_of_joining, u.is_active,
             r.name as role_name, d.name as department_name,
             CONCAT(mgr.first_name, ' ', mgr.last_name) as manager_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN departments d ON u.department_id = d.id
      LEFT JOIN users mgr ON u.manager_id = mgr.id
      WHERE u.is_active = TRUE
    `;
    const params = [];

    // Managers see only their department
    if (req.user.role_name === 'manager') {
      query += ' AND u.department_id = ?';
      params.push(req.user.department_id);
    } else if (department_id) {
      query += ' AND u.department_id = ?';
      params.push(parseInt(department_id));
    }

    if (role) {
      query += ' AND r.name = ?';
      params.push(role);
    }

    if (search) {
      query += ' AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.employee_id LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    query += ' ORDER BY u.first_name ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [employees] = await pool.query(query, params);

    res.json({
      success: true,
      data: employees,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/employees/:id
 * Get single employee detail
 */
const getEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [employees] = await pool.query(
      `SELECT u.id, u.employee_id, u.first_name, u.last_name, u.email,
              u.phone, u.avatar_url, u.department_id, u.manager_id,
              u.designation, u.date_of_joining, u.is_active,
              r.name as role_name, d.name as department_name,
              CONCAT(mgr.first_name, ' ', mgr.last_name) as manager_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       JOIN departments d ON u.department_id = d.id
       LEFT JOIN users mgr ON u.manager_id = mgr.id
       WHERE u.id = ?`,
      [id]
    );

    if (employees.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    res.json({
      success: true,
      data: employees[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/employees/profile
 * Update own profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const { first_name, last_name, phone, department_id } = req.body;
    let avatar_url = req.body.avatar_url; // fallback if they just pass string

    if (req.file) {
      avatar_url = req.protocol + '://' + req.get('host') + '/uploads/' + req.file.filename;
    }

    // Super admins are permanently assigned to HR — don't allow department change
    const allowDeptChange = req.user.role_name !== 'super_admin';

    await pool.query(
      'UPDATE users SET first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name), phone = COALESCE(?, phone), avatar_url = COALESCE(?, avatar_url), department_id = CASE WHEN ? AND ? IS NOT NULL THEN ? ELSE department_id END WHERE id = ?',
      [first_name, last_name, phone, avatar_url, allowDeptChange, department_id ? parseInt(department_id) : null, department_id ? parseInt(department_id) : null, req.user.id]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      avatar_url
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getEmployees, getEmployee, updateProfile };
