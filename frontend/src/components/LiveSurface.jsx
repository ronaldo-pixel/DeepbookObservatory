import React from 'react';
import Plot from 'react-plotly.js';

export function LiveSurface({ liveSurface, loading, refreshing, revision }) {
  // Only show loading screen before first successful load
  if (loading && !liveSurface) {
    return (
      <div className="surface-studio">
        <div className="surface-header">
          <h2>Live Volatility Surface</h2>
          <span className="live-badge">● LIVE</span>
        </div>

        <div className="loading-container">
          <p>Loading live surface...</p>
        </div>
      </div>
    );
  }

  if (!liveSurface) {
    return null;
  }

  const { ks, expiryTimes, surfaceData } = liveSurface;

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
        title: {
          text: 'IV %',
        },
        thickness: 20,
        len: 0.7,
      },
    },
  ];

  const layout = {
    title: {
      text: 'Live Volatility Surface',
      font: {
        size: 16,
        color: '#fff',
      },
    },
    // Preserve zoom/camera between updates
    uirevision: 'surface',
    scene: {
      bgcolor: 'rgba(30,30,40,1)',
      aspectmode: 'cube',
      xaxis: {
        title: {
          text: 'Log-Moneyness k = ln(K/F)',
          font: {
            color: '#fff',
          },
          standoff: 10,
        },
        tickfont: {
          color: '#fff',
        },
        backgroundcolor: 'rgba(20,20,30,0.9)',
        gridcolor: '#444',
        zerolinecolor: '#666',
      },
      yaxis: {
        title: {
          text: 'Time to Expiry (hours)',
          font: {
            color: '#fff',
          },
          standoff: 10,
        },
        tickfont: {
          color: '#fff',
        },
        backgroundcolor: 'rgba(20,20,30,0.9)',
        gridcolor: '#444',
        zerolinecolor: '#666',
      },
      zaxis: {
        title: {
          text: 'Implied Volatility %',
          font: {
            color: '#fff',
          },
          standoff: 10,
        },
        tickfont: {
          color: '#fff',
        },
        backgroundcolor: 'rgba(20,20,30,0.9)',
        gridcolor: '#444',
        zerolinecolor: '#666',
      },
      camera: {
        eye: {
          x: 1.5,
          y: 1.5,
          z: 1.3,
        },
      },
    },
    paper_bgcolor: 'rgba(30,30,40,1)',
    plot_bgcolor: 'rgba(30,30,40,1)',
    font: {
      color: '#fff',
    },
    height: 600,
    margin: {
      l: 50,
      r: 50,
      b: 50,
      t: 50,
    },
    hovermode: 'closest',
  };

  return (
    <div className="surface-studio">
      <div className="surface-header">
        <h2>Live Volatility Surface</h2>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span className="live-badge">● LIVE</span>

          {refreshing && (
            <span
              style={{
                fontSize: '0.85rem',
                color: '#aaa',
              }}
            >
              Updating...
            </span>
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
              filename: 'live_volatility_surface',
              height: 800,
              width: 1200,
              scale: 2,
            },
          }}
          useResizeHandler
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      </div>
    </div>
  );
}