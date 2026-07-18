const app = require('./src/app');
const config = require('./src/config/env');
const { testConnection, initializeDatabase } = require('./src/config/db');

async function startServer() {
  try {
    // Test DB connection
    const isConnected = await testConnection();
    if (!isConnected) {
      console.error('Failed to connect to database. Server will start, but database requests will fail.');
    } else {
      // Initialize DB tables and seed data if needed
      await initializeDatabase();
    }

    app.listen(config.port, () => {
      console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${config.port}`);
      console.log(`🌍 Client URL allowed: ${config.clientUrl}`);
    });
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
}

startServer();
