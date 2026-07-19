const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'employee_management'
    });

    console.log('Adding reset token columns to users table...');
    
    // Using IF NOT EXISTS logic via a try/catch since standard ALTER TABLE doesn't support IF NOT EXISTS in all MySQL versions
    try {
      await conn.query('ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) NULL, ADD COLUMN reset_token_expires DATETIME NULL');
      console.log('Columns added successfully.');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('Columns already exist.');
      } else {
        throw err;
      }
    }

    await conn.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
