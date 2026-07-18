const { pool } = require('../config/db');

/**
 * POST /api/leaves
 * Submit a new leave request
 */
const createLeaveRequest = async (req, res, next) => {
  try {
    const { leave_type_id, start_date, end_date, reason } = req.body;
    const userId = req.user.id;

    // Calculate total days (simple calculation — excludes weekends for now)
    const start = new Date(start_date);
    const end = new Date(end_date);
    if (end < start) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date',
      });
    }

    let totalDays = 0;
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        totalDays++;
      }
      current.setDate(current.getDate() + 1);
    }

    if (totalDays === 0) {
      return res.status(400).json({
        success: false,
        message: 'Leave request must include at least one working day',
      });
    }

    // Check leave balance
    const currentYear = new Date().getFullYear();
    const [balances] = await pool.query(
      'SELECT remaining_days FROM leave_balances WHERE user_id = ? AND leave_type_id = ? AND year = ?',
      [userId, leave_type_id, currentYear]
    );

    if (balances.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Leave balance not found. Contact HR to initialize your leave balance.',
      });
    }

    if (parseFloat(balances[0].remaining_days) < totalDays) {
      return res.status(400).json({
        success: false,
        message: `Insufficient leave balance. Available: ${balances[0].remaining_days} days, Requested: ${totalDays} days`,
      });
    }

    // Check for overlapping leave requests
    const [overlaps] = await pool.query(
      `SELECT id FROM leave_requests 
       WHERE user_id = ? AND status IN ('pending', 'approved')
       AND ((start_date <= ? AND end_date >= ?) OR (start_date <= ? AND end_date >= ?) 
            OR (start_date >= ? AND end_date <= ?))`,
      [userId, end_date, start_date, start_date, start_date, start_date, end_date]
    );

    if (overlaps.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have a leave request for overlapping dates',
      });
    }

    // Create leave request
    const [result] = await pool.query(
      `INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, total_days, reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, leave_type_id, start_date, end_date, totalDays, reason]
    );

    // Create notification for manager
    if (req.user.manager_id) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, link)
         VALUES (?, ?, ?, 'leave', '/leaves')`,
        [
          req.user.manager_id,
          'New Leave Request',
          `${req.user.first_name} ${req.user.last_name} has requested ${totalDays} day(s) of leave.`,
        ]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully',
      data: { id: result.insertId, total_days: totalDays, status: 'pending' },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leaves
 * Get own leave history
 */
const getLeaves = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT lr.*, lt.name as leave_type_name,
             CONCAT(approver.first_name, ' ', approver.last_name) as approved_by_name
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN users approver ON lr.approved_by = approver.id
      WHERE lr.user_id = ?
    `;
    const params = [req.user.id];

    if (status) {
      query += ' AND lr.status = ?';
      params.push(status);
    }

    query += ' ORDER BY lr.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [records] = await pool.query(query, params);

    res.json({
      success: true,
      data: records,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leaves/balance
 * Get current user's leave balances
 */
const getLeaveBalance = async (req, res, next) => {
  try {
    const currentYear = new Date().getFullYear();

    const [balances] = await pool.query(
      `SELECT lb.*, lt.name as leave_type_name, lt.description
       FROM leave_balances lb
       JOIN leave_types lt ON lb.leave_type_id = lt.id
       WHERE lb.user_id = ? AND lb.year = ?`,
      [req.user.id, currentYear]
    );

    res.json({
      success: true,
      data: balances,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/leaves/:id/cancel
 * Cancel own pending leave request
 */
const cancelLeave = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [requests] = await pool.query(
      'SELECT * FROM leave_requests WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found',
      });
    }

    if (requests[0].status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending leave requests can be cancelled',
      });
    }

    await pool.query(
      'UPDATE leave_requests SET status = ? WHERE id = ?',
      ['cancelled', id]
    );

    res.json({
      success: true,
      message: 'Leave request cancelled successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leaves/pending
 * Get pending leave requests from team (Manager/Admin)
 */
const getPendingLeaves = async (req, res, next) => {
  try {
    let query = `
      SELECT lr.*, lt.name as leave_type_name,
             u.first_name, u.last_name, u.employee_id, u.designation,
             d.name as department_name
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN users u ON lr.user_id = u.id
      JOIN departments d ON u.department_id = d.id
      WHERE lr.status = 'pending'
    `;
    const params = [];

    query += ' ORDER BY lr.created_at ASC';

    const [records] = await pool.query(query, params);

    res.json({
      success: true,
      data: records,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leaves/approved
 */
const getApprovedLeaves = async (req, res, next) => {
  try {
    const [records] = await pool.query(
      `SELECT lr.*, lt.name as leave_type_name,
              CONCAT(u.first_name, ' ', u.last_name) as user_name,
              CONCAT(approver.first_name, ' ', approver.last_name) as approved_by_name
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       JOIN users u ON lr.user_id = u.id
       LEFT JOIN users approver ON lr.approved_by = approver.id
       WHERE lr.status = 'approved'
       ORDER BY lr.updated_at DESC`
    );

    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leaves/rejected
 */
const getRejectedLeaves = async (req, res, next) => {
  try {
    const [records] = await pool.query(
      `SELECT lr.*, lt.name as leave_type_name,
              CONCAT(u.first_name, ' ', u.last_name) as user_name,
              CONCAT(approver.first_name, ' ', approver.last_name) as approved_by_name
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       JOIN users u ON lr.user_id = u.id
       LEFT JOIN users approver ON lr.approved_by = approver.id
       WHERE lr.status = 'rejected'
       ORDER BY lr.updated_at DESC`
    );

    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/leaves/:id/approve
 * Approve a leave request
 */
const approveLeave = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [requests] = await pool.query(
      `SELECT lr.*, u.department_id, u.first_name, u.last_name, u.id as req_user_id
       FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       WHERE lr.id = ?`,
      [id]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found',
      });
    }

    const request = requests[0];

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending requests can be approved',
      });
    }

    // Admin or super admin is allowed to approve any pending request
    if (!['admin', 'super_admin'].includes(req.user.role_name)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can approve leave requests',
      });
    }

    // Update leave request status
    await pool.query(
      'UPDATE leave_requests SET status = ?, approved_by = ? WHERE id = ?',
      ['approved', req.user.id, id]
    );

    // Deduct leave balance
    const currentYear = new Date().getFullYear();
    await pool.query(
      `UPDATE leave_balances 
       SET used_days = used_days + ?, remaining_days = remaining_days - ?
       WHERE user_id = ? AND leave_type_id = ? AND year = ?`,
      [request.total_days, request.total_days, request.user_id, request.leave_type_id, currentYear]
    );

    // Notify employee
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, link)
       VALUES (?, ?, ?, 'leave', '/leaves')`,
      [
        request.req_user_id,
        'Leave Request Approved',
        `Your leave request from ${request.start_date} to ${request.end_date} has been approved.`,
      ]
    );

    res.json({
      success: true,
      message: 'Leave request approved successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/leaves/:id/reject
 * Reject a leave request
 */
const rejectLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;

    const [requests] = await pool.query(
      `SELECT lr.*, u.department_id, u.id as req_user_id
       FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       WHERE lr.id = ?`,
      [id]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found',
      });
    }

    if (requests[0].status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending requests can be rejected',
      });
    }

    if (!['admin', 'super_admin'].includes(req.user.role_name)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can reject leave requests',
      });
    }

    await pool.query(
      'UPDATE leave_requests SET status = ?, approved_by = ?, rejection_reason = ? WHERE id = ?',
      ['rejected', req.user.id, rejection_reason || 'No reason provided', id]
    );

    // Notify employee
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, link)
       VALUES (?, ?, ?, 'leave', '/leaves')`,
      [
        requests[0].req_user_id,
        'Leave Request Rejected',
        `Your leave request has been rejected. Reason: ${rejection_reason || 'No reason provided'}`,
      ]
    );

    res.json({
      success: true,
      message: 'Leave request rejected',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createLeaveRequest, getLeaves, getLeaveBalance,
  cancelLeave, getPendingLeaves, getApprovedLeaves, getRejectedLeaves,
  approveLeave, rejectLeave,
};
