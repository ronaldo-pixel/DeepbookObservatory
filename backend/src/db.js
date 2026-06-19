/**
 * Database connection and utilities for DeepBook Observatory
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;

/**
 * Initialize database connection pool
 */
async function initDb() {
  pool = await mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  console.log('✓ Database pool initialized');
  return pool;
}


/**
 * Save keeper redemption log
 */
async function saveKeeperLog(positionId, ownerAddress, payoutAmount, txDigest) {
  const query = `
    INSERT INTO keeper_logs (position_id, owner_address, payout_amount, tx_digest)
    VALUES (?, ?, ?, ?)
  `;

  const [result] = await pool.execute(query, [
    positionId,
    ownerAddress,
    payoutAmount,
    txDigest,
  ]);

  return result;
}

/**
 * Get recent keeper logs (last N entries)
 */
async function getKeeperLogs(limit = 50) {
  const query = `
    SELECT * FROM keeper_logs 
    ORDER BY redeemed_at DESC 
    LIMIT ?
  `;

  const [rows] = await pool.execute(query, [limit]);
  return rows;
}

/**
 * Check if position already redeemed
 */
async function isPositionRedeemed(positionId) {
  const query = `
    SELECT id FROM keeper_logs 
    WHERE position_id = ? 
    LIMIT 1
  `;

  const [rows] = await pool.execute(query, [positionId]);
  return rows.length > 0;
}



module.exports = {
  initDb,
  saveKeeperLog,
  getKeeperLogs,
  isPositionRedeemed,
};
