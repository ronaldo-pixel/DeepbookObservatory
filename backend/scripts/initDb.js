/**
 * Database initialization script
 * Creates MySQL schema and tables for DeepBook Observatory
 */

const mysql = require('mysql2/promise');
require('dotenv').config({
  path: '../.env'
});

// Fix for prepared statement issue with USE command
const path = require('path');
const fs = require('fs');

const SQL_SCHEMA = `
CREATE TABLE IF NOT EXISTS svi_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  oracle_id VARCHAR(100) NOT NULL,
  timestamp BIGINT NOT NULL,
  spot DECIMAL(20,6),
  forward DECIMAL(20,6),
  svi_a DECIMAL(20,10),
  svi_b DECIMAL(20,10),
  svi_rho DECIMAL(20,10),
  svi_m DECIMAL(20,10),
  svi_sigma DECIMAL(20,10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_oracle_time (oracle_id, timestamp)
);

CREATE TABLE IF NOT EXISTS keeper_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  position_id VARCHAR(100) NOT NULL,
  owner_address VARCHAR(100),
  payout_amount DECIMAL(20,6),
  tx_digest VARCHAR(100),
  redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_position_id (position_id)
);
`;

async function initDatabase() {
  try {
    // Connect to MySQL server (without database selected)
    const connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      port: process.env.MYSQL_PORT,
    });

    console.log('Connected to MySQL server');

    // Create database if it doesn't exist (use query, not execute)
    await connection.query(`
      CREATE DATABASE IF NOT EXISTS ${process.env.MYSQL_DATABASE}
    `);
    console.log(`Database '${process.env.MYSQL_DATABASE}' created or already exists`);

    // Switch to the database (use query, not execute)
    await connection.query(`USE ${process.env.MYSQL_DATABASE}`);

    // Create tables (use query for DDL)
    const statements = SQL_SCHEMA.split(';').filter(s => s.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        await connection.query(statement);
        console.log('✓ Table created or already exists');
      }
    }

    console.log('✓ Database initialization complete');
    await connection.end();
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  }
}

initDatabase();
