const { pool } = require('../config/db');
const { isWithinGeofence } = require('../services/geofenceService');
const config = require('../config/env');
const fs = require('fs');
const path = require('path');

/**
 * POST /api/attendance/check-in
 * Record check-in with selfie and GPS coordinates
 */
const checkIn = async (req, res, next) => {
  try {
    const { latitude, longitude, address } = req.body;
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Check if already checked in today
    const [existing] = await pool.query(
      'SELECT id, check_in_time FROM attendance_records WHERE user_id = ? AND date = ?',
      [userId, today]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked in today',
      });
    }

    // Validate coordinates
    if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
      return res.status(400).json({
        success: false,
        message: 'GPS coordinates are required for check-in',
      });
    }

    const parsedLatitude = parseFloat(latitude);
    const parsedLongitude = parseFloat(longitude);

    if (Number.isNaN(parsedLatitude) || Number.isNaN(parsedLongitude)) {
      return res.status(400).json({
        success: false,
        message: 'GPS coordinates must be valid numbers',
      });
    }

    // Handle selfie — either from file upload or base64 in body
    let selfieUrl = null;
    if (!req.file && !req.body.selfie_base64) {
      return res.status(400).json({
        success: false,
        message: 'A selfie is required for check-in',
      });
    }
    if (req.file) {
      selfieUrl = `/uploads/selfies/${req.file.filename}`;
    } else if (req.body.selfie_base64) {
      // Save base64 image to file
      const base64Data = req.body.selfie_base64.replace(/^data:image\/\w+;base64,/, '');
      const filename = `selfie-${userId}-${Date.now()}.jpg`;
      const filepath = path.join(__dirname, '..', '..', 'uploads', 'selfies', filename);
      fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));
      selfieUrl = `/uploads/selfies/${filename}`;
    }

    // Check geofence
    const geofenceResult = await isWithinGeofence(parsedLatitude, parsedLongitude);
    if (!geofenceResult.isWithin) {
      return res.status(400).json({
        success: false,
        message: `Attendance outside office geofence. Your current location is ${geofenceResult.distance ?? 0}m away from the nearest office (${geofenceResult.officeName ?? 'unknown'}).`,
        debug: {
          receivedCoordinates: { latitude: parsedLatitude, longitude: parsedLongitude },
          nearestOffice: {
            id: geofenceResult.officeId,
            name: geofenceResult.officeName,
            radiusMeters: geofenceResult.radiusMeters || null,
            isActive: geofenceResult.officeIsActive,
            usedActiveQuery: geofenceResult.usedActiveQuery,
          }
        }
      });
    }

    // Determine attendance status based on time
    const now = new Date();
    const [startHour, startMinute] = config.attendance.officeStartTime.split(':').map(Number);
    const officeStart = new Date(now);
    officeStart.setHours(startHour, startMinute, 0, 0);

    const lateThreshold = new Date(officeStart);
    lateThreshold.setMinutes(lateThreshold.getMinutes() + config.attendance.lateThresholdMinutes);

    let status = 'present';
    if (now > lateThreshold) {
      const halfDayThreshold = new Date(officeStart);
      halfDayThreshold.setHours(halfDayThreshold.getHours() + 4);
      status = now > halfDayThreshold ? 'half_day' : 'late';
    }

    // Insert attendance record
    const [result] = await pool.query(
      `INSERT INTO attendance_records 
        (user_id, date, check_in_time, check_in_latitude, check_in_longitude, 
         check_in_selfie_url, check_in_address, status, is_within_geofence)
       VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?)`,
      [userId, today, parsedLatitude, parsedLongitude, selfieUrl, address || '', status, geofenceResult.isWithin]
    );

    res.status(201).json({
      success: true,
      message: 'Check-in recorded successfully',
      data: {
        id: result.insertId,
        date: today,
        check_in_time: new Date().toISOString(),
        status,
        is_within_geofence: geofenceResult.isWithin,
        geofence: geofenceResult,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/attendance/check-out
 * Record check-out with selfie and GPS coordinates
 */
const checkOut = async (req, res, next) => {
  try {
    const { latitude, longitude, address } = req.body;
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Find today's attendance record
    const [records] = await pool.query(
      'SELECT id, check_in_time, check_out_time FROM attendance_records WHERE user_id = ? AND date = ?',
      [userId, today]
    );

    if (records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'You haven\'t checked in today. Please check in first.',
      });
    }

    if (records[0].check_out_time) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked out today',
      });
    }

    // Handle selfie
    let selfieUrl = null;
    if (req.file) {
      selfieUrl = `/uploads/selfies/${req.file.filename}`;
    } else if (req.body.selfie_base64) {
      const base64Data = req.body.selfie_base64.replace(/^data:image\/\w+;base64,/, '');
      const filename = `selfie-${userId}-checkout-${Date.now()}.jpg`;
      const filepath = path.join(__dirname, '..', '..', 'uploads', 'selfies', filename);
      fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));
      selfieUrl = `/uploads/selfies/${filename}`;
    }

    // Check geofence
    const parsedLatitude = latitude !== undefined && latitude !== null ? parseFloat(latitude) : NaN;
    const parsedLongitude = longitude !== undefined && longitude !== null ? parseFloat(longitude) : NaN;
    const geofenceResult = !Number.isNaN(parsedLatitude) && !Number.isNaN(parsedLongitude)
      ? await isWithinGeofence(parsedLatitude, parsedLongitude)
      : { isWithin: false, officeName: null, distance: null };

    if (!Number.isNaN(parsedLatitude) && !Number.isNaN(parsedLongitude) && !geofenceResult.isWithin) {
      return res.status(400).json({
        success: false,
        message: `Check-out outside office geofence. Your current location is ${geofenceResult.distance ?? 0}m away from the nearest office.`,
        debug: {
          receivedCoordinates: { latitude: parsedLatitude, longitude: parsedLongitude },
          nearestOffice: {
            name: geofenceResult.officeName,
            radiusMeters: geofenceResult.radiusMeters || null,
          }
        }
      });
    }

    // Calculate total hours
    const checkInTime = new Date(records[0].check_in_time);
    const checkOutTime = new Date();
    const totalHours = ((checkOutTime - checkInTime) / (1000 * 60 * 60)).toFixed(2);

    // Update attendance record
    await pool.query(
      `UPDATE attendance_records 
       SET check_out_time = NOW(), 
           check_out_latitude = ?, check_out_longitude = ?,
           check_out_selfie_url = ?, check_out_address = ?,
           total_hours = ?
       WHERE id = ?`,
      [parsedLatitude || null, parsedLongitude || null, selfieUrl, address || '', totalHours, records[0].id]
    );

    res.json({
      success: true,
      message: 'Check-out recorded successfully',
      data: {
        id: records[0].id,
        check_out_time: checkOutTime.toISOString(),
        total_hours: parseFloat(totalHours),
        geofence: geofenceResult,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/attendance/today
 * Get current user's today attendance status
 */
const getToday = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [records] = await pool.query(
      'SELECT * FROM attendance_records WHERE user_id = ? AND date = ?',
      [req.user.id, today]
    );

    res.json({
      success: true,
      data: records.length > 0 ? records[0] : null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/attendance/history
 * Get attendance history with pagination and date filters
 */
const getHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { start_date, end_date, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = 'SELECT * FROM attendance_records WHERE user_id = ?';
    let countQuery = 'SELECT COUNT(*) as total FROM attendance_records WHERE user_id = ?';
    const params = [userId];
    const countParams = [userId];

    if (start_date) {
      query += ' AND date >= ?';
      countQuery += ' AND date >= ?';
      params.push(start_date);
      countParams.push(start_date);
    }

    if (end_date) {
      query += ' AND date <= ?';
      countQuery += ' AND date <= ?';
      params.push(end_date);
      countParams.push(end_date);
    }

    query += ' ORDER BY date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [records] = await pool.query(query, params);
    const [total] = await pool.query(countQuery, countParams);

    res.json({
      success: true,
      data: {
        records,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total[0].total,
          totalPages: Math.ceil(total[0].total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/attendance/report
 * Get team attendance report (Manager/Admin only)
 */
const getReport = async (req, res, next) => {
  try {
    const { date, department_id, page = 1, limit = 20 } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT ar.*, u.first_name, u.last_name, u.employee_id, u.designation,
             d.name as department_name
      FROM attendance_records ar
      JOIN users u ON ar.user_id = u.id
      JOIN departments d ON u.department_id = d.id
      WHERE ar.date = ?
    `;
    const params = [targetDate];

    // Managers can only see their department
    if (req.user.role_name === 'manager') {
      query += ' AND u.department_id = ?';
      params.push(req.user.department_id);
    } else if (department_id) {
      query += ' AND u.department_id = ?';
      params.push(parseInt(department_id));
    }

    query += ' ORDER BY u.first_name ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [records] = await pool.query(query, params);

    // Get total employee count for attendance percentage
    let totalQuery = 'SELECT COUNT(*) as total FROM users WHERE is_active = TRUE';
    const totalParams = [];
    if (req.user.role_name === 'manager') {
      totalQuery += ' AND department_id = ?';
      totalParams.push(req.user.department_id);
    } else if (department_id) {
      totalQuery += ' AND department_id = ?';
      totalParams.push(parseInt(department_id));
    }

    const [totalResult] = await pool.query(totalQuery, totalParams);

    res.json({
      success: true,
      data: {
        records,
        date: targetDate,
        total_employees: totalResult[0].total,
        present_count: records.length,
        attendance_percentage: totalResult[0].total > 0
          ? ((records.length / totalResult[0].total) * 100).toFixed(1)
          : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { checkIn, checkOut, getToday, getHistory, getReport };
