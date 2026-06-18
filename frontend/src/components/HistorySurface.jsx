import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { getHistoricalSurface } from '../utils/sviMath';

export function HistorySurface({ oracles, historyCache }) {
  const [timeSliderValue, setTimeSliderValue] = useState(60);
  const [debouncedValue, setDebouncedValue] = useState(60);
  const [surfaceToDisplay, setSurfaceToDisplay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revision, setRevision] = useState(0);

  function formatRelativeTime(minutes) {
    if (minutes === 0) return 'current snapshot';

    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    const mins = minutes % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0 && days === 0) parts.push(`${mins}m`);

    return `${parts.join(' ')} ago`;
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(timeSliderValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [timeSliderValue]);

  useEffect(() => {
    if (!oracles || oracles.length === 0) return;
    const controller = new AbortController();

    async function loadSurface() {
      try {
        if (surfaceToDisplay) setRefreshing(true);

        const surface = await getHistoricalSurface(
          oracles,
          debouncedValue,
          historyCache,
          controller.signal
        );

        if (!controller.signal.aborted) {
          if (surface) {
            setSurfaceToDisplay(surface);
            setRevision(prev => prev + 1);
          }
        }
      } catch (err) {
        if (err.name !== 'CanceledError') console.error('Surface load failed:', err);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    loadSurface();
    return () => controller.abort();
  }, [oracles, debouncedValue]);

  if (loading && !surfaceToDisplay) {
    return (
      <div className="surface-studio">
        <div className="surface-header">
          <h2>Historical Volatility Surface</h2>
          <span className="historical-badge">{formatRelativeTime(timeSliderValue)}</span>
        </div>
        <div className="loading-container">
          <p>Loading volatility surface...</p>
        </div>
      </div>
    );
  }

  if (!surfaceToDisplay) return null;

  const { ks, expiryTimes, surfaceData } = surfaceToDisplay;

  const plotData = [
    {
      x: ks,
      y: expiryTimes,
      z: surfaceData,
      type: 'surface',
      colorscale: 'RdYlGn-r',
      name: 'Implied Volatility %',
      showscale: true,
      colorbar: {
        title: { text: 'IV %' },
        thickness: 20,
        len: 0.7,
      },
    },
  ];

  const layout = {
    title: {
      text: `Historical Volatility Surface — ${formatRelativeTime(timeSliderValue)}`,
      font: { size: 16, color: '#fff' },
    },
    uirevision: 'surface',
    scene: {
      bgcolor: 'rgba(30,30,40,1)',
      aspectmode: 'cube',
      xaxis: {
        title: { text: 'Log-Moneyness k = ln(K/F)', font: { color: '#fff' }, standoff: 10 },
        tickfont: { color: '#fff' },
        backgroundcolor: 'rgba(20,20,30,0.9)',
        gridcolor: '#444',
        zerolinecolor: '#666',
      },
      yaxis: {
        title: { text: 'Time to Expiry (hours)', font: { color: '#fff' }, standoff: 10 },
        tickfont: { color: '#fff' },
        backgroundcolor: 'rgba(20,20,30,0.9)',
        gridcolor: '#444',
        zerolinecolor: '#666',
      },
      zaxis: {
        title: { text: 'Implied Volatility %', font: { color: '#fff' }, standoff: 10 },
        tickfont: { color: '#fff' },
        backgroundcolor: 'rgba(20,20,30,0.9)',
        gridcolor: '#444',
        zerolinecolor: '#666',
      },
      camera: { eye: { x: 1.5, y: 1.5, z: 1.3 } },
    },
    paper_bgcolor: 'rgba(30,30,40,1)',
    plot_bgcolor: 'rgba(30,30,40,1)',
    font: { color: '#fff' },
    height: 600,
    margin: { l: 50, r: 50, b: 50, t: 50 },
    hovermode: 'closest',
  };

  return (
    <div className="surface-studio">
      <div className="surface-header">
        <h2>Historical Volatility Surface</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="historical-badge">{formatRelativeTime(timeSliderValue)}</span>
          {refreshing && (
            <span style={{ fontSize: '0.85rem', color: '#aaa' }}>Updating...</span>
          )}
        </div>
      </div>

      <div className="plot-container">
        <Plot
          revision={revision}
          data={plotData}
          layout={layout}
          config={{
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
            toImageButtonOptions: {
              format: 'png',
              filename: 'volatility_surface',
              height: 800,
              width: 1200,
              scale: 2,
            },
          }}
          useResizeHandler
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      <div className="time-slider-container">
        <div className="slider-header">
          <label>Surface Timeline</label>
          <span className="slider-time">{formatRelativeTime(timeSliderValue)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="10080"
          value={timeSliderValue}
          onChange={(e) => setTimeSliderValue(Number(e.target.value))}
          className="slider-input"
        />
        <div className="slider-labels">
          <span>current</span>
          <span>7d Ago</span>
        </div>
      </div>
    </div>
  );
}