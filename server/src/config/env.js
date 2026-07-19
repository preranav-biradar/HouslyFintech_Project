require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'shree',
    database: process.env.DB_NAME || 'employee_management',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  attendance: {
    officeStartTime: process.env.OFFICE_START_TIME || '09:00',
    lateThresholdMinutes: parseInt(process.env.LATE_THRESHOLD_MINUTES) || 15,
  },
  geofence: {
    bypass: process.env.GEOFENCE_BYPASS === 'true',
    defaultRadiusMeters: parseInt(process.env.GEOFENCE_DEFAULT_RADIUS) || 0,
  },
};
