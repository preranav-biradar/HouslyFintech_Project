const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

/**
 * POST /api/admin/employees
 * Create a new employee
 */
const createEmployee = async (req, res, next) => {
  try {
    const {
      first_name, last_name, email, phone,
      role_id, department_id, manager_id,
      designation, date_of_joining,
    } = req.body;

    // Generate employee ID
    const [lastEmployee] = await pool.query(
      'SELECT employee_id FROM users ORDER BY id DESC LIMIT 1'
    );

    let newEmpId = 'EMP-001';
    if (lastEmployee.length > 0) {
      const lastNum = parseInt(lastEmployee[0].employee_id.split('-')[1]);
      newEmpId = `EMP-${String(lastNum + 1).padStart(3, '0')}`;
    }

    // Hash default password
    const salt = await bcrypt.genSalt(10);
    const defaultPassword = 'Employee@123';
    const passwordHash = await bcrypt.hash(defaultPassword, salt);

    const [result] = await pool.query(
      `INSERT INTO users (employee_id, first_name, last_name, email, password_hash, 
                          phone, role_id, department_id, manager_id, designation, date_of_joining)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newEmpId, first_name, last_name, email, passwordHash,
       phone || null, role_id, department_id, manager_id || null,
       designation || null, date_of_joining || new Date().toISOString().split('T')[0]]
    );

    // Initialize leave balances for the new employee
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
      message: `Employee created successfully. Default password: ${defaultPassword}`,
      data: {
        id: result.insertId,
        employee_id: newEmpId,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/employees/:id
 * Update an employee's details
 */
const updateEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      first_name, last_name, email, phone,
      role_id, department_id, manager_id,
      designation, is_active,
    } = req.body;

    const [existing] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    await pool.query(
      `UPDATE users SET 
        first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        role_id = COALESCE(?, role_id),
        department_id = COALESCE(?, department_id),
        manager_id = ?,
        designation = COALESCE(?, designation),
        is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [first_name, last_name, email, phone, role_id, department_id,
       manager_id !== undefined ? manager_id : null,
       designation, is_active, id]
    );

    res.json({ success: true, message: 'Employee updated successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/employees/:id
 * Soft delete (deactivate) an employee
 */
const deleteEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent deleting own account
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account' });
    }

    await pool.query('UPDATE users SET is_active = FALSE WHERE id = ?', [id]);

    res.json({ success: true, message: 'Employee deactivated successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/employees/:id/reset-password
 * Reset employee password to default
 */
const resetPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const defaultPassword = 'Employee@123';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(defaultPassword, salt);

    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);

    res.json({
      success: true,
      message: `Password reset to: ${defaultPassword}`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/dashboard
 * Get admin dashboard summary stats
 * Query param: role (optional) - filter by role name
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { role } = req.query;

    // Base role filter
    const roleFilter = role ? ' AND r.name = ?' : '';
    const roleParams = role ? [role] : [];

    // Total active employees (with optional role filter)
    const [empCount] = await pool.query(
      `SELECT COUNT(*) as total FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.is_active = TRUE${roleFilter}`,
      roleParams
    );

    // Today's attendance (with optional role filter)
    const [attendanceCount] = await pool.query(
      `SELECT COUNT(*) as total FROM attendance_records ar
       JOIN users u ON ar.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE ar.date = ? AND u.is_active = TRUE${roleFilter}`,
      [today, ...roleParams]
    );

    // Pending leave requests (with optional role filter)
    const [pendingLeaves] = await pool.query(
      `SELECT COUNT(*) as total FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE lr.status = 'pending' AND u.is_active = TRUE${roleFilter}`,
      roleParams
    );

    // Pending expense claims (with optional role filter)
    const [pendingExpenses] = await pool.query(
      `SELECT COUNT(*) as total, COALESCE(SUM(amount), 0) as total_amount 
       FROM expense_claims ec
       JOIN users u ON ec.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE ec.status = 'pending' AND u.is_active = TRUE${roleFilter}`,
      roleParams
    );

    // Department-wise employee count and today attendance (with optional role filter)
    const [deptStats] = await pool.query(
      `SELECT d.name,
              COUNT(u.id) as employee_count,
              SUM(CASE WHEN ar.date = ? THEN 1 ELSE 0 END) as present_today
       FROM departments d
       LEFT JOIN users u ON d.id = u.department_id AND u.is_active = TRUE
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN attendance_records ar ON ar.user_id = u.id AND ar.date = ?
       WHERE d.is_active = TRUE${roleFilter}
       GROUP BY d.id, d.name`,
      [today, today, ...roleParams]
    );

    // Recent activity (last 10 notifications)
    const [recentActivity] = await pool.query(
      `SELECT n.*, CONCAT(u.first_name, ' ', u.last_name) as user_name
       FROM notifications n
       JOIN users u ON n.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.is_active = TRUE${roleFilter}
       ORDER BY n.created_at DESC LIMIT 10`,
      roleParams
    );

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Recent attendance entries for the admin view (today and yesterday only)
    const [recentAttendance] = await pool.query(
      `SELECT ar.id, ar.date, ar.check_in_time, ar.check_out_time, CONCAT(u.first_name, ' ', u.last_name) as user_name
       FROM attendance_records ar
       JOIN users u ON ar.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.is_active = TRUE AND ar.date IN (?, ?)${roleFilter}
       ORDER BY ar.date DESC, ar.check_in_time DESC
       LIMIT 50`,
      [today, yesterday, ...roleParams]
    );

    // Pending leave requests for admin view
    const [pendingLeaveItems] = await pool.query(
      `SELECT lr.id, lr.status, lr.total_days, lr.reason, lr.start_date, lr.end_date,
              lt.name as leave_type_name, CONCAT(u.first_name, ' ', u.last_name) as user_name
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       JOIN users u ON lr.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE lr.status = 'pending' AND u.is_active = TRUE${roleFilter}
       ORDER BY lr.created_at DESC
       LIMIT 20`,
      roleParams
    );

    // Approved leave requests for admin view
    const [approvedLeaveItems] = await pool.query(
      `SELECT lr.id, lr.status, lr.total_days, lr.reason, lr.start_date, lr.end_date,
              lt.name as leave_type_name, CONCAT(u.first_name, ' ', u.last_name) as user_name,
              CONCAT(approver.first_name, ' ', approver.last_name) as approved_by_name
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       JOIN users u ON lr.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN users approver ON lr.approved_by = approver.id
       WHERE lr.status = 'approved' AND u.is_active = TRUE${roleFilter}
       ORDER BY lr.updated_at DESC
       LIMIT 20`,
      roleParams
    );

    // Rejected leave requests for admin view
    const [rejectedLeaveItems] = await pool.query(
      `SELECT lr.id, lr.status, lr.total_days, lr.reason, lr.start_date, lr.end_date,
              lr.rejection_reason, lt.name as leave_type_name, CONCAT(u.first_name, ' ', u.last_name) as user_name,
              CONCAT(approver.first_name, ' ', approver.last_name) as approved_by_name
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       JOIN users u ON lr.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN users approver ON lr.approved_by = approver.id
       WHERE lr.status = 'rejected' AND u.is_active = TRUE${roleFilter}
       ORDER BY lr.updated_at DESC
       LIMIT 20`,
      roleParams
    );

    // Pending expense claims for admin view
    const [pendingExpenseItems] = await pool.query(
      `SELECT ec.id, ec.amount, ec.status, ec.title, ec.description,
              ec.expense_date, CONCAT(u.first_name, ' ', u.last_name) as user_name
       FROM expense_claims ec
       JOIN users u ON ec.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE ec.status = 'pending' AND u.is_active = TRUE${roleFilter}
       ORDER BY ec.created_at DESC
       LIMIT 20`,
      roleParams
    );

    // Approved expense claims for admin view
    const [approvedExpenseItems] = await pool.query(
      `SELECT ec.id, ec.amount, ec.status, ec.title, ec.description,
              ec.expense_date, CONCAT(u.first_name, ' ', u.last_name) as user_name,
              CONCAT(approver.first_name, ' ', approver.last_name) as approved_by_name
       FROM expense_claims ec
       JOIN users u ON ec.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN users approver ON ec.approved_by = approver.id
       WHERE ec.status = 'approved' AND u.is_active = TRUE${roleFilter}
       ORDER BY ec.updated_at DESC
       LIMIT 20`
    , roleParams
    );

    // Rejected expense claims for admin view
    const [rejectedExpenseItems] = await pool.query(
      `SELECT ec.id, ec.amount, ec.status, ec.title, ec.description,
              ec.expense_date, ec.rejection_reason, CONCAT(u.first_name, ' ', u.last_name) as user_name,
              CONCAT(approver.first_name, ' ', approver.last_name) as approved_by_name
       FROM expense_claims ec
       JOIN users u ON ec.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN users approver ON ec.approved_by = approver.id
       WHERE ec.status = 'rejected' AND u.is_active = TRUE${roleFilter}
       ORDER BY ec.updated_at DESC
       LIMIT 20`,
      roleParams
    );

    const employeeActivity = recentActivity.map((item) => ({
      title: item.title,
      subtitle: `${item.user_name} • ${new Date(item.created_at).toLocaleString()}`,
    }));

    res.json({
      success: true,
      data: {
        totalEmployees: empCount[0].total,
        total_employees: empCount[0].total,
        todayAttendance: attendanceCount[0].total,
        today_attendance: attendanceCount[0].total,
        attendancePercentage: empCount[0].total > 0
          ? ((attendanceCount[0].total / empCount[0].total) * 100).toFixed(1)
          : 0,
        attendance_percentage: empCount[0].total > 0
          ? ((attendanceCount[0].total / empCount[0].total) * 100).toFixed(1)
          : 0,
        pendingLeaves: pendingLeaves[0].total,
        pending_leaves: pendingLeaves[0].total,
        pendingExpensesCount: pendingExpenses[0].total,
        pendingExpensesAmount: pendingExpenses[0].total_amount,
        pending_expenses: {
          count: pendingExpenses[0].total,
          amount: pendingExpenses[0].total_amount,
        },
        departmentStats: deptStats,
        department_stats: deptStats,
        recentActivity,
        recent_activity: recentActivity,
        employeeActivity,
        employee_activity: employeeActivity,
        attendanceRecords: recentAttendance,
        recent_attendance: recentAttendance,
        pendingLeaveRequests: pendingLeaveItems,
        pending_leave_items: pendingLeaveItems,
        approvedLeaveRequests: approvedLeaveItems,
        approved_leave_items: approvedLeaveItems,
        rejectedLeaveRequests: rejectedLeaveItems,
        rejected_leave_items: rejectedLeaveItems,
        pendingExpenseRequests: pendingExpenseItems,
        pending_expense_items: pendingExpenseItems,
        approvedExpenseRequests: approvedExpenseItems,
        approved_expense_items: approvedExpenseItems,
        rejectedExpenseRequests: rejectedExpenseItems,
        rejected_expense_items: rejectedExpenseItems,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ========== Department CRUD ==========

const getDepartments = async (req, res, next) => {
  try {
    const [departments] = await pool.query(
      `SELECT d.*, COUNT(u.id) as employee_count
       FROM departments d
       LEFT JOIN users u ON d.id = u.department_id AND u.is_active = TRUE
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

// ========== Office Location CRUD ==========

const getOfficeLocations = async (req, res, next) => {
  try {
    const [locations] = await pool.query('SELECT * FROM office_locations ORDER BY name');
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
      `UPDATE office_locations 
       SET name = COALESCE(?, name), address = COALESCE(?, address), 
           latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude),
           radius_meters = COALESCE(?, radius_meters), is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name, address, latitude, longitude, radius_meters, is_active, id]
    );
    res.json({ success: true, message: 'Office location updated' });
  } catch (error) {
    next(error);
  }
};

// ========== Roles & Leave Types & Expense Categories ==========

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
    const [types] = await pool.query('SELECT * FROM leave_types ORDER BY name');
    res.json({ success: true, data: types });
  } catch (error) {
    next(error);
  }
};

const getExpenseCategories = async (req, res, next) => {
  try {
    const [categories] = await pool.query('SELECT * FROM expense_categories ORDER BY name');
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

// ========== Notifications ==========

const getNotifications = async (req, res, next) => {
  try {
    const [notifications] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );

    const [unreadCount] = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [req.user.id]
    );

    res.json({
      success: true,
      data: { notifications, unread_count: unreadCount[0].count },
    });
  } catch (error) {
    next(error);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === 'all') {
      await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.user.id]);
    } else {
      await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [id, req.user.id]);
    }
    res.json({ success: true, message: 'Marked as read' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createEmployee, updateEmployee, deleteEmployee, resetPassword,
  getDashboardStats,
  getDepartments, createDepartment, updateDepartment,
  getOfficeLocations, createOfficeLocation, updateOfficeLocation,
  getRoles, getLeaveTypes, getExpenseCategories,
  getNotifications, markNotificationRead,
};
