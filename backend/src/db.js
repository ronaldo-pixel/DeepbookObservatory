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
 * Save SVI snapshot to database
 */
async function saveSVISnapshot(oracleId, timestamp, spot, forward, sviParams) {
  const query = `
    INSERT INTO svi_snapshots 
    (oracle_id, timestamp, spot, forward, svi_a, svi_b, svi_rho, svi_m, svi_sigma)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const [result] = await pool.execute(query, [
    oracleId,
    timestamp,
    spot,
    forward,
    sviParams.a,
    sviParams.b,
    sviParams.rho,
    sviParams.m,
    sviParams.sigma,
  ]);

  return result;
}

/**
 * Get SVI snapshots for last N hours
 */
async function getSVIHistory(oracleId, hours = 4) {
  const query = `
    SELECT * FROM svi_snapshots 
    WHERE oracle_id = ? 
    AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
    ORDER BY timestamp ASC
  `;

  const [rows] = await pool.execute(query, [oracleId, hours]);
  return rows;
}

/**
 * Get latest SVI snapshot for oracle
 */
async function getLatestSVISnapshot(oracleId) {
  const query = `
    SELECT * FROM svi_snapshots 
    WHERE oracle_id = ? 
    ORDER BY timestamp DESC 
    LIMIT 1
  `;

  const [rows] = await pool.execute(query, [oracleId]);
  return rows[0] || null;
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

/**
 * Get all SVI snapshots since timestamp (for regime calculation)
 */
async function getSVISnapshotsSince(timestamp) {
  const query = `
    SELECT * FROM svi_snapshots 
    WHERE timestamp >= ? 
    ORDER BY oracle_id, timestamp ASC
  `;

  const [rows] = await pool.execute(query, [timestamp]);
  return rows;
}

module.exports = {
  initDb,
  saveSVISnapshot,
  getSVIHistory,
  getLatestSVISnapshot,
  saveKeeperLog,
  getKeeperLogs,
  isPositionRedeemed,
  getSVISnapshotsSince,
};
