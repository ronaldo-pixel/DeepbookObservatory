/**
 * DeepBook Observatory — Backend API Server
 * Minimal Express server exposing keeper log data to the frontend.
 */

const express = require('express');
const cors    = require('cors');
const { initDb, getKeeperLogs } = require('./db');
require('dotenv').config();

const app  = express();
const PORT = process.env.BACKEND_PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Health ───────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

// ── Keeper logs ──────────────────────────────────────────
// GET /keeper/logs?limit=50
app.get('/keeper/logs', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const logs  = await getKeeperLogs(limit);
    res.json(logs);
  } catch (err) {
    console.error('GET /keeper/logs error:', err.message);
    res.status(500).json({ error: 'Failed to fetch keeper logs' });
  }
});

// ── Boot ─────────────────────────────────────────────────
async function start() {
  try {
    await initDb();
    console.log('✓ DB connected');
  } catch (err) {
    console.error('❌ DB init failed:', err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`✓ Server listening on http://localhost:${PORT}`);
  });
}

start();
