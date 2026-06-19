import React from 'react';

const REGIME_CONFIG = {
  normal:   { color: '#4ade80', label: 'Normal',   description: 'ATM IV within normal range, upward sloping term structure.' },
  elevated: { color: '#facc15', label: 'Elevated', description: 'ATM IV elevated. Exercise caution with directional bets.' },
  extreme:  { color: '#f87171', label: 'Extreme',  description: 'ATM IV extremely high. Market pricing tail risk.' },
  inverted: { color: '#fb923c', label: 'Inverted', description: 'Term structure inverted. Front vol exceeds back vol.' },
};

export function SurfaceAnalysis({ analysis }) {
  if (!analysis) return null;

  const { calendarViolations, butterflyViolations, regime } = analysis;
  const regimeConfig = REGIME_CONFIG[regime?.regime] ?? REGIME_CONFIG.normal;

  return (
    <div className="surface-analysis">

      {/* Regime */}
      <div className="analysis-card">
        <div className="analysis-card-header">
          <span className="analysis-title">Volatility Regime</span>
          <span className="regime-badge" style={{ color: regimeConfig.color }}>
            ● {regimeConfig.label}
          </span>
        </div>
        <p className="analysis-description">{regimeConfig.description}</p>
        {regime && (
          <div className="regime-stats">
            <span>Front ATM IV: <strong>{regime.frontATMIV}%</strong></span>
            <span>Back ATM IV: <strong>{regime.backATMIV}%</strong></span>
            <span>Slope: <strong>{regime.slope}%</strong></span>
          </div>
        )}
      </div>

      {/* Calendar Violations */}
      <div className="analysis-card">
        <div className="analysis-card-header">
          <span className="analysis-title">Calendar Violations</span>
          <span
            className="violation-badge"
            style={{ color: calendarViolations.length > 0 ? '#f87171' : '#4ade80' }}
          >
            {calendarViolations.length > 0 ? `${calendarViolations.length} found` : '✓ None'}
          </span>
        </div>
        {calendarViolations.length > 0 ? (
          <div className="violation-list">
            {calendarViolations.map((v, i) => (
              <div key={i} className="violation-item">
                Total variance decreases from expiry{' '}
                <strong>{new Date(v.expiry1).toLocaleDateString()}</strong> →{' '}
                <strong>{new Date(v.expiry2).toLocaleDateString()}</strong> at k={v.k}
              </div>
            ))}
          </div>
        ) : (
          <p className="analysis-description">No calendar arbitrage detected.</p>
        )}
      </div>

      {/* Butterfly Violations */}
      <div className="analysis-card">
        <div className="analysis-card-header">
          <span className="analysis-title">Butterfly Violations</span>
          <span
            className="violation-badge"
            style={{ color: butterflyViolations.length > 0 ? '#f87171' : '#4ade80' }}
          >
            {butterflyViolations.length > 0 ? `${butterflyViolations.length} found` : '✓ None'}
          </span>
        </div>
        {butterflyViolations.length > 0 ? (
          <div className="violation-list">
            {butterflyViolations.map((v, i) => (
              <div key={i} className="violation-item">
                Negative probability density at expiry{' '}
                <strong>{new Date(v.expiry).toLocaleDateString()}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="analysis-description">No butterfly arbitrage detected.</p>
        )}
      </div>

    </div>
  );
}