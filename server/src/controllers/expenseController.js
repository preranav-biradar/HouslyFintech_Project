const { pool } = require('../config/db');
const path = require('path');

/**
 * POST /api/expenses
 * Submit a new expense claim
 */
const createExpense = async (req, res, next) => {
  try {
    const { category_id, title, description, amount, expense_date } = req.body;
    const userId = req.user.id;

    // Validate category and check max amount
    const [categories] = await pool.query(
      'SELECT * FROM expense_categories WHERE id = ? AND is_active = TRUE',
      [category_id]
    );

    if (categories.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid expense category',
      });
    }

    if (categories[0].max_amount && parseFloat(amount) > parseFloat(categories[0].max_amount)) {
      return res.status(400).json({
        success: false,
        message: `Amount exceeds the maximum limit of ₹${categories[0].max_amount} for ${categories[0].name}`,
      });
    }

    // Handle receipt upload
    let receiptUrl = null;
    if (req.file) {
      receiptUrl = `/uploads/receipts/${req.file.filename}`;
    }

    const [result] = await pool.query(
      `INSERT INTO expense_claims (user_id, category_id, title, description, amount, expense_date, receipt_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, category_id, title, description || '', amount, expense_date, receiptUrl]
    );

    // Notify manager
    if (req.user.manager_id) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, link)
         VALUES (?, ?, ?, 'expense', '/expenses')`,
        [
          req.user.manager_id,
          'New Expense Claim',
          `${req.user.first_name} ${req.user.last_name} submitted an expense claim of ₹${amount} for ${title}.`,
        ]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Expense claim submitted successfully',
      data: { id: result.insertId, status: 'pending' },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/expenses
 * Get own expense history
 */
const getExpenses = async (req, res, next) => {
  try {
    const { status, category_id, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT ec.*, cat.name as category_name,
             CONCAT(approver.first_name, ' ', approver.last_name) as approved_by_name
      FROM expense_claims ec
      JOIN expense_categories cat ON ec.category_id = cat.id
      LEFT JOIN users approver ON ec.approved_by = approver.id
      WHERE ec.user_id = ?
    `;
    const params = [req.user.id];

    if (status) {
      query += ' AND ec.status = ?';
      params.push(status);
    }

    if (category_id) {
      query += ' AND ec.category_id = ?';
      params.push(parseInt(category_id));
    }

    query += ' ORDER BY ec.created_at DESC LIMIT ? OFFSET ?';
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
 * GET /api/expenses/summary
 * Get expense summary totals
 */
const getExpenseSummary = async (req, res, next) => {
  try {
    const [summary] = await pool.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_amount,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) as approved_amount,
        COALESCE(SUM(CASE WHEN status = 'reimbursed' THEN amount ELSE 0 END), 0) as reimbursed_amount,
        COALESCE(SUM(CASE WHEN status = 'rejected' THEN amount ELSE 0 END), 0) as rejected_amount,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'reimbursed' THEN 1 END) as reimbursed_count
       FROM expense_claims WHERE user_id = ?`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: summary[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/expenses/:id
 * Update own pending expense
 */
const updateExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { category_id, title, description, amount, expense_date } = req.body;

    const [expenses] = await pool.query(
      'SELECT * FROM expense_claims WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (expenses.length === 0) {
      return res.status(404).json({ success: false, message: 'Expense claim not found' });
    }

    if (expenses[0].status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending claims can be edited' });
    }

    let receiptUrl = expenses[0].receipt_url;
    if (req.file) {
      receiptUrl = `/uploads/receipts/${req.file.filename}`;
    }

    await pool.query(
      `UPDATE expense_claims 
       SET category_id = ?, title = ?, description = ?, amount = ?, expense_date = ?, receipt_url = ?
       WHERE id = ?`,
      [category_id, title, description, amount, expense_date, receiptUrl, id]
    );

    res.json({ success: true, message: 'Expense claim updated successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/expenses/:id
 * Delete own pending expense
 */
const deleteExpense = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [expenses] = await pool.query(
      'SELECT * FROM expense_claims WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (expenses.length === 0) {
      return res.status(404).json({ success: false, message: 'Expense claim not found' });
    }

    if (expenses[0].status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending claims can be deleted' });
    }

    await pool.query('DELETE FROM expense_claims WHERE id = ?', [id]);

    res.json({ success: true, message: 'Expense claim deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/expenses/pending
 * Get pending expenses from team (Manager/Admin)
 */
const getPendingExpenses = async (req, res, next) => {
  try {
    let query = `
      SELECT ec.*, cat.name as category_name,
             u.first_name, u.last_name, u.employee_id, u.designation,
             d.name as department_name
      FROM expense_claims ec
      JOIN expense_categories cat ON ec.category_id = cat.id
      JOIN users u ON ec.user_id = u.id
      JOIN departments d ON u.department_id = d.id
      WHERE ec.status = 'pending'
    `;
    const params = [];

    query += ' ORDER BY ec.created_at ASC';

    const [records] = await pool.query(query, params);

    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/expenses/approved
 */
const getApprovedExpenses = async (req, res, next) => {
  try {
    const [records] = await pool.query(
      `SELECT ec.*, cat.name as category_name,
              CONCAT(u.first_name, ' ', u.last_name) as user_name,
              CONCAT(approver.first_name, ' ', approver.last_name) as approved_by_name
       FROM expense_claims ec
       JOIN expense_categories cat ON ec.category_id = cat.id
       JOIN users u ON ec.user_id = u.id
       LEFT JOIN users approver ON ec.approved_by = approver.id
       WHERE ec.status = 'approved'
       ORDER BY ec.updated_at DESC`
    );

    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/expenses/rejected
 */
const getRejectedExpenses = async (req, res, next) => {
  try {
    const [records] = await pool.query(
      `SELECT ec.*, cat.name as category_name,
              CONCAT(u.first_name, ' ', u.last_name) as user_name,
              CONCAT(approver.first_name, ' ', approver.last_name) as approved_by_name
       FROM expense_claims ec
       JOIN expense_categories cat ON ec.category_id = cat.id
       JOIN users u ON ec.user_id = u.id
       LEFT JOIN users approver ON ec.approved_by = approver.id
       WHERE ec.status = 'rejected'
       ORDER BY ec.updated_at DESC`
    );

    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/expenses/:id/approve
 */
const approveExpense = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [expenses] = await pool.query(
      `SELECT ec.*, u.department_id, u.id as req_user_id
       FROM expense_claims ec
       JOIN users u ON ec.user_id = u.id
       WHERE ec.id = ?`,
      [id]
    );

    if (expenses.length === 0) {
      return res.status(404).json({ success: false, message: 'Expense claim not found' });
    }

    if (expenses[0].status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending claims can be approved' });
    }

    if (!['admin', 'super_admin'].includes(req.user.role_name)) {
      return res.status(403).json({ success: false, message: 'Only admins can approve expense claims' });
    }

    await pool.query(
      'UPDATE expense_claims SET status = ?, approved_by = ? WHERE id = ?',
      ['approved', req.user.id, id]
    );

    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, link)
       VALUES (?, ?, ?, 'expense', '/expenses')`,
      [expenses[0].req_user_id, 'Expense Claim Approved', `Your expense claim of ₹${expenses[0].amount} has been approved.`]
    );

    res.json({ success: true, message: 'Expense claim approved successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/expenses/:id/reject
 */
const rejectExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;

    const [expenses] = await pool.query(
      `SELECT ec.*, u.department_id, u.id as req_user_id
       FROM expense_claims ec JOIN users u ON ec.user_id = u.id WHERE ec.id = ?`,
      [id]
    );

    if (expenses.length === 0) {
      return res.status(404).json({ success: false, message: 'Expense claim not found' });
    }

    if (expenses[0].status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending claims can be rejected' });
    }

    if (!['admin', 'super_admin'].includes(req.user.role_name)) {
      return res.status(403).json({ success: false, message: 'Only admins can reject expense claims' });
    }

    await pool.query(
      'UPDATE expense_claims SET status = ?, approved_by = ?, rejection_reason = ? WHERE id = ?',
      ['rejected', req.user.id, rejection_reason || 'No reason provided', id]
    );

    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, link)
       VALUES (?, ?, ?, 'expense', '/expenses')`,
      [expenses[0].req_user_id, 'Expense Claim Rejected', `Your expense claim has been rejected. Reason: ${rejection_reason || 'No reason provided'}`]
    );

    res.json({ success: true, message: 'Expense claim rejected' });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/expenses/:id/reimburse
 * Mark as reimbursed (Admin only)
 */
const reimburseExpense = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [expenses] = await pool.query(
      `SELECT ec.*, u.id as req_user_id FROM expense_claims ec JOIN users u ON ec.user_id = u.id WHERE ec.id = ?`,
      [id]
    );

    if (expenses.length === 0) {
      return res.status(404).json({ success: false, message: 'Expense claim not found' });
    }

    if (expenses[0].status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Only approved claims can be marked as reimbursed' });
    }

    await pool.query(
      'UPDATE expense_claims SET status = ?, reimbursed_at = NOW() WHERE id = ?',
      ['reimbursed', id]
    );

    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, link)
       VALUES (?, ?, ?, 'expense', '/expenses')`,
      [expenses[0].req_user_id, 'Expense Reimbursed', `Your expense claim of ₹${expenses[0].amount} has been reimbursed.`]
    );

    res.json({ success: true, message: 'Expense marked as reimbursed' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createExpense, getExpenses, getExpenseSummary, updateExpense,
  deleteExpense, getPendingExpenses, getApprovedExpenses, getRejectedExpenses,
  approveExpense, rejectExpense, reimburseExpense,
};
