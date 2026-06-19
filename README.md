# DeepBook Observatory

A real-time volatility surface analytics platform for [DeepBook Predict](https://predict-server.testnet.mystenlabs.com) on the Sui blockchain. Renders interactive 3D implied volatility surfaces from live SVI oracle data, with historical replay, arbitrage detection, and oracle health monitoring.

---

## Architecture

```
frontend/
├── src/
│   ├── App.jsx                     # Root component — header, status, layout
│   ├── index.js                    # React entrypoint
│   ├── index.css                   # Global dark-theme styles
│   ├── components/
│   │   ├── LiveSurface.jsx         # 3D IV surface (20s auto-refresh)
│   │   ├── HistorySurface.jsx      # Historical 3D surface with time slider (up to 7d ago)
│   │   ├── SurfaceAnalysis.jsx     # Regime badge + calendar & butterfly violation cards
│   │   └── OracleHealthPanel.jsx   # Per-oracle SVI feed health (lag, avg interval, expiry)
│   ├── hooks/
│   │   └── useSurfaceData.js       # Fetches oracle list; polls Sui GraphQL for OracleActivated / OracleSettled events
│   └── utils/
│       └── sviMath.js              # SVI math (normalization, IV calc, surface build, arbitrage checks, regime detection)
└── public/
    └── index.html
```

---

## Features

| Feature | Details |
|---|---|
| **Live Volatility Surface** | Interactive 3D Plotly surface, refreshes every 20 s. Axes: log-moneyness `k = ln(K/F)`, time to expiry (hours), implied volatility (%). |
| **Historical Replay** | Scrub up to 7 days back with a time slider. Debounced 300 ms. Uses in-memory cache for settled oracles. |
| **Surface Analysis** | Calendar arbitrage detection (total variance must be monotone in expiry), butterfly arbitrage detection (Dupire local-vol density ≥ 0). |
| **Volatility Regime** | Auto-classified: `Normal` / `Elevated` / `Extreme` / `Inverted`. Based on front-ATM IV and term structure slope. |
| **Oracle Health Panel** | Per-oracle cards showing update lag, average SVI interval, and time to expiry. Status: `HEALTHY` / `SLOW` / `STALE` / `CRITICAL` / `UNKNOWN`. |
| **Sui Event Streaming** | Polls `OracleActivated` and `OracleSettled` events via Sui GraphQL every 10 minutes to keep the oracle list current. |

---

## SVI Model

The platform implements the **Stochastic Volatility Inspired (SVI)** parametrisation:

```
w(k) = a + b · (ρ(k − m) + √((k − m)² + σ²))
IV(k, T) = √(w(k) / T)
```

Parameters `(a, b, ρ, m, σ)` are fetched directly from the DeepBook Predict oracle API and normalized from fixed-point integers (scale `1e9`).

---

## Frontend Setup

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Install

```bash
cd frontend
npm install
```

### Environment

Copy `.env.example` and fill in your values (defaults point to Mysten Labs testnet):

```bash
cp frontend/.env.example frontend/.env
```

| Variable | Default | Description |
|---|---|---|
| `REACT_APP_PREDICT_SERVER` | `https://predict-server.testnet.mystenlabs.com` | DeepBook Predict REST API base URL |
| `REACT_APP_PREDICT_ID` | `0xc8736…` | Predict market ID |
| `REACT_APP_PREDICT_PACKAGE` | `0xf5ea2…` | Sui package ID for event filtering |

### Run (development)

```bash
cd frontend
npm start
```

Opens at `http://localhost:3000`. API calls are proxied to `http://localhost:3001` (backend).

### Build (production)

```bash
cd frontend
npm run build
```

---

## Docker

Run the frontend in a container (served via nginx):

```bash
docker-compose up frontend
```

Or bring up the full stack:

```bash
docker-compose up
```

Pass environment variables via a root-level `.env` file (see `.env.example` in the frontend folder).

---

## Key API Endpoints consumed by the frontend

Base URL: `REACT_APP_PREDICT_SERVER` (default: `https://predict-server.testnet.mystenlabs.com`)

| Method | Path | Used by |
|---|---|---|
| `GET` | `/predicts/:predict_id/oracles` | `useSurfaceData` — initial oracle list |
| `GET` | `/oracles/:oracle_id/svi?limit=5&order=desc` | `getLiveSurface` — latest SVI params |
| `GET` | `/oracles/:oracle_id/prices?limit=5&order=desc` | `getLiveSurface` — latest spot/forward |
| `GET` | `/oracles/:oracle_id/svi` | `getHistoricalSurface` — full SVI history |
| `GET` | `/oracles/:oracle_id/prices` | `getHistoricalSurface` — full price history |

### Sui GraphQL

Endpoint: `https://graphql.testnet.sui.io/graphql`

Events polled every **10 minutes**:

| Event type | Handler |
|---|---|
| `<package>::oracle::OracleActivated` | Inserts new oracle into sorted list |
| `<package>::oracle::OracleSettled` | Marks oracle settled, loads full history into cache, prunes oracles > 7d old |

---

## Dependencies

| Package | Purpose |
|---|---|
| `react`, `react-dom` | UI framework |
| `react-scripts` | CRA build tooling |
| `plotly.js` + `react-plotly.js` | 3D surface plots |
| `recharts` | (available, reserved for future 2D charts) |
| `axios` | HTTP client for oracle REST API |
| `@mysten/sui` | Sui GraphQL client for event polling |
