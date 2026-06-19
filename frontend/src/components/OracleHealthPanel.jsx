import React from 'react';

const STATUS_CONFIG = {
  HEALTHY:  { color: '#4ade80', icon: '●', label: 'Healthy' },
  SLOW:     { color: '#facc15', icon: '●', label: 'Slow' },
  STALE:    { color: '#f87171', icon: '●', label: 'Stale' },
  CRITICAL: { color: '#ef4444', icon: '▲', label: 'Critical' },
  UNKNOWN:  { color: '#6b7280', icon: '○', label: 'Unknown' },
};

function formatDuration(ms) {
  if (ms == null) return '—';

  const s = Math.round(ms / 1000);

  if (s < 60) {
    return `${s}s`;
  }

  const m = Math.floor(s / 60);
  if (m < 60) {
    const remS = s % 60;
    return remS > 0 ? `${m}m ${remS}s` : `${m}m`;
  }

  const h = Math.floor(m / 60);
  if (h < 24) {
    const remM = m % 60;
    return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
  }

  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH > 0 ? `${d}d ${remH}h` : `${d}d`;
}

function formatExpiry(ts) {
  const d = new Date(ts);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function OracleHealthPanel({ oracleHealth }) {
  if (!oracleHealth || oracleHealth.length === 0) return null;

  return (
    <div className="oracle-health-panel">
      <div className="oracle-health-header">
        <span className="oracle-health-title">Oracle Feed Health</span>
        <span className="oracle-health-subtitle">SVI update latency · {oracleHealth.length} active</span>
      </div>

      <div className="oracle-health-grid">
        {oracleHealth.map((oracle) => {
          const cfg = STATUS_CONFIG[oracle.status] ?? STATUS_CONFIG.UNKNOWN;
          return (
            <div key={oracle.oracle_id} className="oracle-health-card">
              <div className="oracle-health-card-top">
                <span className="oracle-expiry">{formatExpiry(oracle.expiry)}</span>
                <span className="oracle-status-badge" style={{ color: cfg.color }}>
                  {cfg.icon} {cfg.label}
                </span>
              </div>

              <div className="oracle-health-metrics">
                <div className="oracle-metric">
                  <span className="oracle-metric-label">Last update</span>
                  <span
                    className="oracle-metric-value"
                    style={{ color: oracle.status === 'STALE' || oracle.status === 'CRITICAL' ? '#f87171' : '#fff' }}
                  >
                    {formatDuration(oracle.lag)} ago
                  </span>
                </div>
                <div className="oracle-metric">
                  <span className="oracle-metric-label">Avg interval</span>
                  <span className="oracle-metric-value">
                    {oracle.avgInterval ? formatDuration(oracle.avgInterval) : '—'}
                  </span>
                </div>
                <div className="oracle-metric">
                  <span className="oracle-metric-label">Expiry in</span>
                  <span
                    className="oracle-metric-value"
                    style={{ color: oracle.timeToExpiry < 5 * 60 * 1000 ? '#f87171' : '#fff' }}
                  >
                    {formatDuration(oracle.timeToExpiry)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
