const mysql = require('mysql2');
require('dotenv').config();

let pool;

const createPool = () => {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'project_management_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  return pool;
};

createPool();

const promisePool = () => pool.promise();

// Retry connection with exponential backoff
const connectWithRetry = (retries = 10, delay = 3000) => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error(`❌ Database connection failed (${retries} retries left):`, err.message);
      if (retries > 0) {
        console.log(`⏳ Retrying in ${delay / 1000}s...`);
        setTimeout(() => connectWithRetry(retries - 1, delay * 1.5), delay);
      } else {
        console.error('💀 Could not connect to database after all retries');
        process.exit(1);
      }
      return;
    }
    console.log('✅ Database connected successfully');
    connection.release();
  });
};

connectWithRetry();

// Export a proxy that always uses the current pool
module.exports = {
  query: (...args) => pool.promise().query(...args),
  execute: (...args) => pool.promise().execute(...args),
  getConnection: (...args) => pool.promise().getConnection(...args),
};
