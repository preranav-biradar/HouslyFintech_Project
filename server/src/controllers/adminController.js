const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');

// ========== Dashboard Stats ==========

const getDashboardStats = async (req, res, next) => {
  try {
    const { role } = req.query;

    let userFilter = '';
    const params = [];

    if (role) {
      userFilter = ' AND r.name = ?';
      params.push(role);
    }

    // Total employees
    const [[{ totalEmployees }]] = await pool.query(
      `SELECT COUNT(*) as totalEmployees FROM users u JOIN roles r ON u.role_id = r.id WHERE u.is_active = TRUE ${userFilter}`,
      params
    );

    // Today's attendance
    const today = new Date().toISOString().slice(0, 10);
    const [[{ todayAttendance }]] = await pool.query(
      `SELECT COUNT(DISTINCT a.user_id) as todayAttendance
       FROM attendance_records a
       JOIN users u ON a.user_id = u.id
       JOIN roles r ON u.role_id = r.id
       WHERE DATE(a.date) = ? AND u.is_active = TRUE ${userFilter}`,
      [today, ...params]
    );

    // Pending leaves
    const [[{ pendingLeaves }]] = await pool.query(
      `SELECT COUNT(*) as pendingLeaves FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       JOIN roles r ON u.role_id = r.id
       WHERE lr.status = 'pending' AND u.is_active = TRUE ${userFilter}`,
      params
    );

    // Pending expenses
    const [[{ pendingExpensesCount, pendingExpensesAmount }]] = await pool.query(
      `SELECT COUNT(*) as pendingExpensesCount, COALESCE(SUM(er.amount), 0) as pendingExpensesAmount
       FROM expense_claims er
       JOIN users u ON er.user_id = u.id
       JOIN roles r ON u.role_id = r.id
       WHERE er.status = 'pending' AND u.is_active = TRUE ${userFilter}`,
      params
    );

    // Department stats
    const [departmentStats] = await pool.query(
      `SELECT d.name,
              COUNT(DISTINCT u.id) as employee_count,
              COUNT(DISTINCT CASE WHEN DATE(a.date) = ? THEN a.user_id END) as present_today
       FROM departments d
       LEFT JOIN users u ON d.id = u.department_id AND u.is_active = TRUE
       LEFT JOIN attendance_records a ON a.user_id = u.id AND DATE(a.date) = ?
       GROUP BY d.id, d.name
       ORDER BY d.name`,
      [today, today]
    );

    // Recent attendance records (last 2 days)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const [attendanceRecords] = await pool.query(
      `SELECT a.id, a.date, a.check_in_time, a.check_out_time, a.status,
              CONCAT(u.first_name, ' ', u.last_name) as user_name, d.name as department_name
       FROM attendance_records a
       JOIN users u ON a.user_id = u.id
       JOIN departments d ON u.department_id = d.id
       JOIN roles r ON u.role_id = r.id
       WHERE (DATE(a.date) = ? OR DATE(a.date) = ?) AND u.is_active = TRUE ${userFilter}
       ORDER BY a.check_in_time DESC
       LIMIT 20`,
      [today, yesterday, ...params]
    );

    // Pending leave requests detail
    const [pendingLeaveRequests] = await pool.query(
      `SELECT lr.id, lr.start_date, lr.end_date, lr.reason, lr.status,
              lt.name as leave_type_name,
              CONCAT(u.first_name, ' ', u.last_name) as user_name
       FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       JOIN roles r ON u.role_id = r.id
       WHERE lr.status = 'pending' AND u.is_active = TRUE ${userFilter}
       ORDER BY lr.created_at DESC LIMIT 5`,
      params
    );

    // Pending expense requests detail
    const [pendingExpenseRequests] = await pool.query(
      `SELECT er.id, er.title, er.amount, er.expense_date, er.status,
              CONCAT(u.first_name, ' ', u.last_name) as user_name
       FROM expense_claims er
       JOIN users u ON er.user_id = u.id
       JOIN roles r ON u.role_id = r.id
       WHERE er.status = 'pending' AND u.is_active = TRUE ${userFilter}
       ORDER BY er.created_at DESC LIMIT 5`,
      params
    );

    res.json({
      success: true,
      data: {
        totalEmployees,
        todayAttendance,
        pendingLeaves,
        pendingExpensesCount,
        pendingExpensesAmount,
        departmentStats,
        attendanceRecords,
        pendingLeaveRequests,
        pendingExpenseRequests,
      }
    });
  } catch (error) {
    next(error);
  }
};

// ========== Employee CRUD ==========

const createEmployee = async (req, res, next) => {
  try {
    const {
      employee_id, first_name, last_name, email, password,
      phone, role_id, department_id, designation, date_of_joining, manager_id
    } = req.body;

    const password_hash = await bcrypt.hash(password || 'Welcome@123', 10);

    const [result] = await pool.query(
      `INSERT INTO users (employee_id, first_name, last_name, email, password_hash, phone, role_id, department_id, designation, date_of_joining, manager_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [employee_id, first_name, last_name, email, password_hash, phone || null,
       role_id, department_id, designation || null, date_of_joining || new Date(), manager_id || null]
    );

    // Initialize leave balances
    const [leaveTypes] = await pool.query('SELECT id, days_per_year FROM leave_types WHERE is_active = TRUE');
    const year = new Date().getFullYear();
    for (const lt of leaveTypes) {
      await pool.query(
        'INSERT IGNORE INTO leave_balances (user_id, leave_type_id, year, total_days, remaining_days) VALUES (?, ?, ?, ?, ?)',
        [result.insertId, lt.id, year, lt.days_per_year, lt.days_per_year]
      );
    }

    res.status(201).json({ success: true, message: 'Employee created successfully', data: { id: result.insertId } });
  } catch (error) {
    next(error);
  }
};

const updateEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, phone, role_id, department_id, designation, manager_id, is_active } = req.body;

    await pool.query(
      `UPDATE users SET
        first_name    = COALESCE(?, first_name),
        last_name     = COALESCE(?, last_name),
        phone         = COALESCE(?, phone),
        role_id       = COALESCE(?, role_id),
        department_id = COALESCE(?, department_id),
        designation   = COALESCE(?, designation),
        manager_id    = COALESCE(?, manager_id),
        is_active     = COALESCE(?, is_active)
       WHERE id = ?`,
      [first_name, last_name, phone, role_id, department_id, designation, manager_id, is_active, id]
    );

    res.json({ success: true, message: 'Employee updated successfully' });
  } catch (error) {
    next(error);
  }
};

const deleteEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE users SET is_active = FALSE WHERE id = ?', [id]);
    res.json({ success: true, message: 'Employee deactivated successfully' });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;
    const password_hash = await bcrypt.hash(new_password || 'Welcome@123', 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, id]);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
};

// ========== Department CRUD ==========

const getDepartments = async (req, res, next) => {
  try {
    const isSuperOrAdmin = ['super_admin', 'admin'].includes(req.user?.role_name);

    // HR is reserved for super_admin — hide it from the public dropdown
    const excludeClause = isSuperOrAdmin ? '' : `WHERE d.name != 'Human Resources'`;

    const [departments] = await pool.query(
      `SELECT d.*, COUNT(u.id) as employee_count
       FROM departments d
       LEFT JOIN users u ON d.id = u.department_id AND u.is_active = TRUE
       ${excludeClause}
       GROUP BY d.id
       ORDER BY d.name`
    );
    res.json({ success: true, data: departments });
  } catch (error) {
    next(error);
  }
};

const createDepartment = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const [result] = await pool.query(
      'INSERT INTO departments (name, description) VALUES (?, ?)',
      [name, description || '']
    );
    res.status(201).json({ success: true, data: { id: result.insertId }, message: 'Department created' });
  } catch (error) {
    next(error);
  }
};

const updateDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, is_active } = req.body;
    await pool.query(
      'UPDATE departments SET name = COALESCE(?, name), description = COALESCE(?, description), is_active = COALESCE(?, is_active) WHERE id = ?',
      [name, description, is_active, id]
    );
    res.json({ success: true, message: 'Department updated' });
  } catch (error) {
    next(error);
  }
};

// ========== Office Locations ==========

const getOfficeLocations = async (req, res, next) => {
  try {
    const [locations] = await pool.query('SELECT * FROM office_locations WHERE is_active = TRUE ORDER BY name');
    res.json({ success: true, data: locations });
  } catch (error) {
    next(error);
  }
};

const createOfficeLocation = async (req, res, next) => {
  try {
    const { name, address, latitude, longitude, radius_meters } = req.body;
    const [result] = await pool.query(
      'INSERT INTO office_locations (name, address, latitude, longitude, radius_meters) VALUES (?, ?, ?, ?, ?)',
      [name, address || '', latitude, longitude, radius_meters || 200]
    );
    res.status(201).json({ success: true, data: { id: result.insertId }, message: 'Office location created' });
  } catch (error) {
    next(error);
  }
};

const updateOfficeLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, address, latitude, longitude, radius_meters, is_active } = req.body;
    await pool.query(
      'UPDATE office_locations SET name = COALESCE(?, name), address = COALESCE(?, address), latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude), radius_meters = COALESCE(?, radius_meters), is_active = COALESCE(?, is_active) WHERE id = ?',
      [name, address, latitude, longitude, radius_meters, is_active, id]
    );
    res.json({ success: true, message: 'Office location updated' });
  } catch (error) {
    next(error);
  }
};

// ========== Lookups ==========

const getRoles = async (req, res, next) => {
  try {
    const [roles] = await pool.query('SELECT * FROM roles ORDER BY hierarchy_level');
    res.json({ success: true, data: roles });
  } catch (error) {
    next(error);
  }
};

const getLeaveTypes = async (req, res, next) => {
  try {
    const [leaveTypes] = await pool.query('SELECT * FROM leave_types WHERE is_active = TRUE ORDER BY name');
    res.json({ success: true, data: leaveTypes });
  } catch (error) {
    next(error);
  }
};

const getExpenseCategories = async (req, res, next) => {
  try {
    const [categories] = await pool.query('SELECT * FROM expense_categories WHERE is_active = TRUE ORDER BY name');
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

// ========== Notifications ==========

const getNotifications = async (req, res, next) => {
  try {
    const [notifications] = await pool.query(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  createEmployee, updateEmployee, deleteEmployee, resetPassword,
  getDepartments, createDepartment, updateDepartment,
  getOfficeLocations, createOfficeLocation, updateOfficeLocation,
  getRoles, getLeaveTypes, getExpenseCategories,
  getNotifications, markNotificationRead,
};
