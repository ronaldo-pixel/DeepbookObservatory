# DeepBook Observatory

A real-time analytics and intelligence platform for DeepBook Predict on Sui blockchain.

## Project Structure

```
/frontend       - React frontend application
/backend        - Node.js + Express backend
/backend/src
  /routes       - API route handlers
  /utils        - Utility functions (SVI computation, regime logic)
  server.js     - Express application & API routes
  keeper.js     - Settlement keeper service
  poller.js     - 15s SVI snapshot poller
  db.js         - MySQL connection & utilities
```

## Development Setup

### 1. Install Dependencies

Backend:
```bash
cd backend
npm install
```

Frontend:
```bash
cd frontend
npm install
```

### 2. Setup Environment

Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

Required:
- MySQL credentials
- Sui testnet wallet private key
- DeepBook API endpoints (already pre-filled)

### 3. Initialize Database

```bash
cd backend
npm run db:init
```

### 4. Run Services

Backend (development with auto-reload):
```bash
cd backend
npm run dev
```

Frontend (in separate terminal):
```bash
cd frontend
npm start
```

### 5. (Optional) Using Docker

```bash
docker-compose up
```

## Build Stages

1. ✅ Project setup & MySQL schema
2. Backend poller (fetch & store SVI snapshots)
3. SVI math utilities
4. 3D volatility surface frontend component
5. Regime detector logic & badge
6. Oracle risk feed
7. Settlement keeper service
8. Historical replay slider
9. Polish & connect all components

## API Endpoints

- `GET /api/surface/:oracle_id` - Get 3D surface data
- `GET /api/surface/:oracle_id/history` - Get 4-hour history
- `GET /api/oracles` - Get oracle list
- `GET /api/regime` - Get current regime classification
- `GET /api/keeper/logs` - Get last 50 keeper redemptions

## External APIs

Base URL: https://predict-server.testnet.mystenlabs.com

Key endpoints:
- `GET /predicts/:predict_id/oracles` - List all oracles
- `GET /oracles/:oracle_id/state` - Oracle state
- `GET /oracles/:oracle_id/svi/latest` - Latest SVI params
- `GET /oracles/:oracle_id/prices/latest` - Latest price

## Sui Events

Subscribe to:
- `oracle::OraclePricesUpdated`
- `oracle::OracleSVIUpdated`
- `oracle::OracleSettled`
- `oracle::OracleActivated`

Filter by package ID: `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138`















