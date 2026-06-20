import React from 'react';
import Plot from 'react-plotly.js';
import { normalizeSVI, calculateTimeToExpiry, calculateImpliedVolatility } from '../utils/sviMath';

// Helper function to determine color based on parameter change
function getChangeColor(current, previous, threshold) {
  if (previous == null || previous === 0) return 'neutral';
  const pctChange = Math.abs((current - previous) / previous);
  
  if (pctChange < threshold) return 'neutral'; // gray/white, no change color
  return current > previous ? 'green' : 'red';
}

// Helper to render parameter with colored values and change arrows
function renderParamValue(current, previous, threshold, formatFn = (v) => v.toFixed(6)) {
  if (current == null) return <span style={{ color: '#6b7280' }}>—</span>;
  
  const colorType = getChangeColor(current, previous, threshold);
  let color = '#fff';
  let arrow = '';
  
  if (colorType === 'green') {
    color = '#4ade80'; // Sleek green
    arrow = ' ▲';
  } else if (colorType === 'red') {
    color = '#f87171'; // Sleek red
    arrow = ' ▼';
  }
  
  return (
    <span style={{ color, fontWeight: 'bold', fontSize: '1rem', fontFamily: 'monospace', transition: 'color 0.2s ease' }}>
      {formatFn(current)}
      <span style={{ fontSize: '0.8rem', marginLeft: '2px' }}>{arrow}</span>
    </span>
  );
}

export function OracleSmileViewer({ oracleHealth, ks, selectedOracleId, onSelectOracle }) {
  if (!oracleHealth || oracleHealth.length === 0) {
    return (
      <div className="surface-studio">
        <div className="surface-header">
          <h2 style={{ fontSize: '1.4rem', color: '#fff' }}>Oracle Volatility Smile & Parameters</h2>
        </div>
        <div className="loading-container" style={{ padding: '2rem 1rem' }}>
          <p style={{ fontSize: '1.1rem', color: '#9ca3af' }}>No active oracles available.</p>
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
  let prevSviVars = null;
  let currentSpot = null;
  let prevSpot = null;
  let currentForward = null;
  let prevForward = null;
  let timeToExpiryHours = null;

  if (selectedOracle && ks && selectedOracle.sviParams) {
    const T = calculateTimeToExpiry(selectedOracle.expiry);
    timeToExpiryHours = (T * 365.25 * 24).toFixed(2);
    
    // Calculate 2D Smile
    const ivs = ks.map(k => calculateImpliedVolatility(k, T, selectedOracle.sviParams) * 100);
    
    // Normalize current and previous SVI params
    sviVars = normalizeSVI(selectedOracle.sviParams);
    prevSviVars = selectedOracle.prevSviParams ? normalizeSVI(selectedOracle.prevSviParams) : null;

    // Normalize current and previous prices
    if (selectedOracle.latestPrice) {
      currentSpot = Number(selectedOracle.latestPrice.spot) / 1e9;
      currentForward = Number(selectedOracle.latestPrice.forward) / 1e9;
    }
    if (selectedOracle.prevPrice) {
      prevSpot = Number(selectedOracle.prevPrice.spot) / 1e9;
      prevForward = Number(selectedOracle.prevPrice.forward) / 1e9;
    }

    smilePlotData =  [
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
      font: { size: 15, color: '#fff', weight: 'bold' }
    },
    uirevision: 'smile',
    paper_bgcolor: 'rgba(30,30,40,0.6)',
    plot_bgcolor: 'rgba(20,20,30,0.8)',
    font: { color: '#fff' },
    height: 600,
    margin: { l: 50, r: 30, b: 50, t: 40 },
    xaxis: {
      title: { text: 'Log-Moneyness k = ln(K/F)', font: { color: '#e5e7eb', size: 12 } },
      tickfont: { color: '#fff', size: 11 },
      gridcolor: '#333',
      zerolinecolor: '#555',
    },
    yaxis: {
      title: { text: 'Implied Volatility %', font: { color: '#e5e7eb', size: 12 } },
      tickfont: { color: '#fff', size: 11 },
      gridcolor: '#333',
      zerolinecolor: '#555',
    },
    hovermode: 'closest',
  };

  return (
    <div className="surface-studio" style={{ background: 'rgba(17, 24, 39, 0.45)', backdropFilter: 'blur(12px)' }}>
      <div className="surface-header" style={{ borderBottom: '1px solid #374151', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#fff', fontWeight: 'bold' }}>Oracle Volatility Smile & Parameters</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label htmlFor="oracle-select" style={{ fontSize: '0.95rem', color: '#e5e7eb', fontWeight: '500' }}>Select Oracle:</label>
          <select 
            id="oracle-select"
            value={selectedOracleId || ''} 
            onChange={(e) => onSelectOracle(e.target.value)}
            style={{
              background: '#1f2937',
              color: '#fff',
              border: '1px solid #4b5563',
              borderRadius: '6px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: '500',
              outline: 'none',
              transition: 'border-color 0.2s'
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
          <p style={{ fontSize: '1.1rem', color: '#9ca3af' }}>Please select an oracle from the dropdown above or click on an oracle card below to view its 2D volatility smile and parameters.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginTop: '10px' }} className="oracle-smile-layout">
          {/* 2D Plot */}
          <div className="plot-container" style={{ minHeight: '350px', background: 'rgba(15, 20, 25, 0.4)' }}>
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
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #2a3347', borderRadius: '8px', padding: '14px' }}>
              <h3 style={{ fontSize: '1.05rem', marginBottom: '10px', color: '#3b82f6', fontWeight: 'bold', borderBottom: '1px solid #2a3347', paddingBottom: '6px' }}>
                Market Price Information
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '2px' }}>Spot Price</div>
                  <div>
                    {renderParamValue(currentSpot, prevSpot, 0.005, (v) => v.toFixed(4))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '2px' }}>Forward Price</div>
                  <div>
                    {renderParamValue(currentForward, prevForward, 0.005, (v) => v.toFixed(4))}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '8px', wordBreak: 'break-all' }}>
                ID: {selectedOracle.oracle_id}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>
                Time to Expiry: <strong style={{ color: '#fff' }}>{timeToExpiryHours}</strong> hours
              </div>
            </div>

            {/* SVI Variables */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #2a3347', borderRadius: '8px', padding: '14px' }}>
              <h3 style={{ fontSize: '1.05rem', marginBottom: '10px', color: '#3b82f6', fontWeight: 'bold', borderBottom: '1px solid #2a3347', paddingBottom: '6px' }}>
                Normalized SVI Parameters
              </h3>
              {sviVars ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 10px' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '2px' }}>a (vertical shift)</div>
                    <div>{renderParamValue(sviVars.a, prevSviVars?.a, 0.05)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '2px' }}>b (slope of smile)</div>
                    <div>{renderParamValue(sviVars.b, prevSviVars?.b, 0.05)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '2px' }}>rho (skew direction)</div>
                    <div>{renderParamValue(sviVars.rho, prevSviVars?.rho, 0.1)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '2px' }}>m (smile center)</div>
                    <div>{renderParamValue(sviVars.m, prevSviVars?.m, 0.05)}</div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '2px' }}>sigma (local curvature)</div>
                    <div>{renderParamValue(sviVars.sigma, prevSviVars?.sigma, 0.05)}</div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.95rem', color: '#6b7280' }}>No SVI variables loaded.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
