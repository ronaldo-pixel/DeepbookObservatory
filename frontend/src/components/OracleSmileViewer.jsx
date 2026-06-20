import React from 'react';
import Plot from 'react-plotly.js';
import { normalizeSVI, calculateTimeToExpiry, calculateImpliedVolatility } from '../utils/sviMath';

export function OracleSmileViewer({ oracleHealth, ks, selectedOracleId, onSelectOracle }) {
  if (!oracleHealth || oracleHealth.length === 0) {
    return (
      <div className="surface-studio">
        <div className="surface-header">
          <h2>Oracle Volatility Smile & Parameters</h2>
        </div>
        <div className="loading-container">
          <p>No active oracles available.</p>
        </div>
      </div>
    );
  }

  const selectedOracle = oracleHealth.find(o => o.oracle_id === selectedOracleId);

  // Expiry formatter
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

  let smilePlotData = null;
  let sviVars = null;
  let latestPrice = null;
  let timeToExpiryHours = null;

  if (selectedOracle && ks && selectedOracle.sviParams) {
    const T = calculateTimeToExpiry(selectedOracle.expiry);
    timeToExpiryHours = (T * 365.25 * 24).toFixed(2);
    
    // Calculate 2D Smile
    const ivs = ks.map(k => calculateImpliedVolatility(k, T, selectedOracle.sviParams) * 100);
    
    // Normalize SVI params
    sviVars = normalizeSVI(selectedOracle.sviParams);
    latestPrice = selectedOracle.latestPrice;

    smilePlotData = [
      {
        x: ks,
        y: ivs,
        type: 'scatter',
        mode: 'lines+markers',
        marker: { color: '#3b82f6', size: 6 },
        line: { color: '#3b82f6', width: 2, shape: 'spline' },
        name: 'Implied Volatility %',
      }
    ];
  }

  const layout = {
    title: {
      text: selectedOracle 
        ? `Implied Volatility Smile — Expiry: ${formatExpiry(selectedOracle.expiry)}`
        : 'Volatility Smile',
      font: { size: 14, color: '#fff' }
    },
    paper_bgcolor: 'rgba(30,30,40,1)',
    plot_bgcolor: 'rgba(20,20,30,0.9)',
    font: { color: '#fff' },
    height: 350,
    margin: { l: 50, r: 30, b: 50, t: 40 },
    xaxis: {
      title: { text: 'Log-Moneyness k = ln(K/F)', font: { color: '#aaa', size: 11 } },
      tickfont: { color: '#fff' },
      gridcolor: '#333',
      zerolinecolor: '#555',
    },
    yaxis: {
      title: { text: 'Implied Volatility %', font: { color: '#aaa', size: 11 } },
      tickfont: { color: '#fff' },
      gridcolor: '#333',
      zerolinecolor: '#555',
    },
    hovermode: 'closest',
  };

  return (
    <div className="surface-studio">
      <div className="surface-header" style={{ borderBottom: '1px solid #374151', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Oracle Volatility Smile & Parameters</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label htmlFor="oracle-select" style={{ fontSize: '0.85rem', color: '#aaa' }}>Select Oracle:</label>
          <select 
            id="oracle-select"
            value={selectedOracleId || ''} 
            onChange={(e) => onSelectOracle(e.target.value)}
            style={{
              background: '#1f2937',
              color: '#fff',
              border: '1px solid #374151',
              borderRadius: '4px',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            <option value="" disabled>-- Choose active oracle --</option>
            {oracleHealth.map((oracle) => (
              <option key={oracle.oracle_id} value={oracle.oracle_id}>
                Expiry: {formatExpiry(oracle.expiry)} ({oracle.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedOracle ? (
        <div className="loading-container" style={{ padding: '2rem 1rem' }}>
          <p>Please select an oracle from the dropdown above or click on an oracle card below to view its 2D volatility smile and parameters.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginTop: '10px' }} className="oracle-smile-layout">
          {/* 2D Plot */}
          <div className="plot-container" style={{ minHeight: '350px' }}>
            {smilePlotData && (
              <Plot
                data={smilePlotData}
                layout={layout}
                config={{ responsive: true, displayModeBar: false }}
                useResizeHandler
                style={{ width: '100%', height: '100%' }}
              />
            )}
          </div>

          {/* Parameters & Price */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Price Details */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #2a3347', borderRadius: '6px', padding: '12px' }}>
              <h3 style={{ fontSize: '0.9rem', marginBottom: '8px', color: '#3b82f6', borderBottom: '1px solid #2a3347', paddingBottom: '4px' }}>Market Price Information</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Spot Price</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>
                    {latestPrice?.spot ? (Number(latestPrice.spot) / 1e9).toFixed(4) : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Forward Price</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>
                    {latestPrice?.forward ? (Number(latestPrice.forward) / 1e9).toFixed(4) : '—'}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '0.7rem', color: '#4b5563', marginTop: '6px' }}>
                ID: {selectedOracle.oracle_id}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#4b5563' }}>
                Time to Expiry: {timeToExpiryHours} hours
              </div>
            </div>

            {/* SVI Variables */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #2a3347', borderRadius: '6px', padding: '12px' }}>
              <h3 style={{ fontSize: '0.9rem', marginBottom: '8px', color: '#3b82f6', borderBottom: '1px solid #2a3347', paddingBottom: '4px' }}>Normalized SVI Parameters</h3>
              {sviVars ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 6px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>a (vertical shift)</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: '500', fontFamily: 'monospace' }}>{sviVars.a.toFixed(6)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>b (slope/angle)</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: '500', fontFamily: 'monospace' }}>{sviVars.b.toFixed(6)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>rho (skewness/rotation)</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: '500', fontFamily: 'monospace' }}>{sviVars.rho.toFixed(6)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>m (translation/center)</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: '500', fontFamily: 'monospace' }}>{sviVars.m.toFixed(6)}</div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>sigma (local curvature)</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: '500', fontFamily: 'monospace' }}>{sviVars.sigma.toFixed(6)}</div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>No SVI variables loaded.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
