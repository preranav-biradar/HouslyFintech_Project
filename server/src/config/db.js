const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const config = require('./env');

// Create connection pool
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: config.db.waitForConnections,
  connectionLimit: config.db.connectionLimit,
  queueLimit: config.db.queueLimit,
  multipleStatements: true,
});

/**
 * Initialize the database: create tables and seed data
 */
async function initializeDatabase() {
  let connection;
  try {
    // First connect without database to create it if needed
    connection = await mysql.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,   // <-- ADD THIS
      multipleStatements: true,
    });

    // Read and execute schema
    const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    await connection.query(schemaSQL);
    console.log('✅ Database schema initialized successfully');

    // Read and execute seed data
    const seedPath = path.join(__dirname, '..', '..', 'database', 'seed.sql');
    const seedSQL = fs.readFileSync(seedPath, 'utf8');
    await connection.query(seedSQL);
    console.log('✅ Seed data loaded successfully');

    await connection.end();
  } catch (error) {
    if (connection) await connection.end();
    // If tables already exist, just log and continue
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('ℹ️  Database tables already exist, skipping initialization');
    } else {
      console.error('❌ Database initialization error:', error.message);
      throw error;
    }
  }
}

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL connection pool established');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MySQL connection failed:', error.message);
    return false;
  }
}

module.exports = { pool, initializeDatabase, testConnection };
