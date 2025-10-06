import pool from './db.ts';

async function testConnection() {
  try {
    const [rows] = await pool.query('SELECT 1 + 1 AS result');
    console.log('Database connection successful:', rows);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

testConnection();
