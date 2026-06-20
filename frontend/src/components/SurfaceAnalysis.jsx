import React from 'react';

const REGIME_CONFIG = {
  normal:   { color: '#4ade80', label: 'Normal',   description: 'ATM IV within normal range, upward sloping term structure.' },
  elevated: { color: '#facc15', label: 'Elevated', description: 'ATM IV elevated. Exercise caution with directional bets.' },
  extreme:  { color: '#f87171', label: 'Extreme',  description: 'ATM IV extremely high. Market pricing tail risk.' },
  inverted: { color: '#fb923c', label: 'Inverted', description: 'Term structure inverted. Front vol exceeds back vol.' },
};

export function SurfaceAnalysis({ analysis, loading }) {
  const calendarViolations = analysis?.calendarViolations || [];
  const butterflyViolations = analysis?.butterflyViolations || [];
  const regime = analysis?.regime;
  const regimeConfig = regime ? (REGIME_CONFIG[regime.regime] ?? REGIME_CONFIG.normal) : null;

  return (
    <div className="surface-analysis">
      {/* Regime */}
      <div className="analysis-card">
        <div className="analysis-card-header">
          <span className="analysis-title">Volatility Regime</span>
          {loading ? (
            <span className="regime-badge" style={{ color: '#eab308' }}>● Loading...</span>
          ) : regimeConfig ? (
            <span className="regime-badge" style={{ color: regimeConfig.color }}>
              ● {regimeConfig.label}
            </span>
          ) : (
            <span className="regime-badge" style={{ color: '#6b7280' }}>○ Unavailable</span>
          )}
        </div>
        {loading ? (
          <p className="analysis-description">Calculating market regime...</p>
        ) : regime ? (
          <>
            <p className="analysis-description">{regimeConfig?.description}</p>
            <div className="regime-stats">
              <span>Front ATM IV: <strong>{regime.frontATMIV}%</strong></span>
              <span>Back ATM IV: <strong>{regime.backATMIV}%</strong></span>
              <span>Slope: <strong>{regime.slope}%</strong></span>
            </div>
          </>
        ) : (
          <p className="analysis-description">No regime classification active.</p>
        )}
      </div>

      {/* Calendar Violations */}
      <div className="analysis-card">
        <div className="analysis-card-header">
          <span className="analysis-title">Calendar Violations</span>
          {loading ? (
            <span className="violation-badge" style={{ color: '#eab308' }}>Checking...</span>
          ) : (
            <span
              className="violation-badge"
              style={{ color: calendarViolations.length > 0 ? '#f87171' : '#4ade80' }}
            >
              {calendarViolations.length > 0 ? `${calendarViolations.length} found` : '✓ None'}
            </span>
          )}
        </div>
        {loading ? (
          <p className="analysis-description">Analyzing calendar spread arbitrage...</p>
        ) : calendarViolations.length > 0 ? (
          <div className="violation-list" style={{ maxHeight: '100px', overflowY: 'auto' }}>
            {calendarViolations.map((v, i) => (
              <div key={i} className="violation-item">
                Total variance decreases from expiry{' '}
                <strong>{new Date(Number(v.expiry1)).toLocaleDateString()}</strong> →{' '}
                <strong>{new Date(Number(v.expiry2)).toLocaleDateString()}</strong> at k={v.k}
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
          {loading ? (
            <span className="violation-badge" style={{ color: '#eab308' }}>Checking...</span>
          ) : (
            <span
              className="violation-badge"
              style={{ color: butterflyViolations.length > 0 ? '#f87171' : '#4ade80' }}
            >
              {butterflyViolations.length > 0 ? `${butterflyViolations.length} found` : '✓ None'}
            </span>
          )}
        </div>
        {loading ? (
          <p className="analysis-description">Analyzing probability density non-negativity...</p>
        ) : butterflyViolations.length > 0 ? (
          <div className="violation-list" style={{ maxHeight: '100px', overflowY: 'auto' }}>
            {butterflyViolations.map((v, i) => (
              <div key={i} className="violation-item">
                Negative probability density at expiry{' '}
                <strong>{new Date(Number(v.expiry)).toLocaleDateString()}</strong>
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