/**
 * SurfaceStudio Component
 * Main 3D volatility surface visualization
 */

import React, { useState, useEffect} from 'react';
import Plot from 'react-plotly.js';
import { getHistoricalSurface } from '../utils/sviMath';

export function SurfaceStudio({
  oracles,
}) {
  const [timeSliderValue, setTimeSliderValue] =
    useState(0);

  const [surfaceToDisplay, setSurfaceToDisplay] =
  useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSurface() {
      const surface =
        await getHistoricalSurface(
          oracles,
          timeSliderValue
        );

      if (!cancelled) {
        setSurfaceToDisplay(surface);
      }
    }

    loadSurface();

    return () => {
      cancelled = true;
    };
  }, [oracles, timeSliderValue]);

  if (!surfaceToDisplay) {
    return (
      <div className="loading-container">
        <p>
          Loading volatility surface...
        </p>
      </div>
    );
  }

  const {
    ks,
    expiryTimes,
    surfaceData,
  } = surfaceToDisplay;

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
        title: 'IV %',
        thickness: 20,
        len: 0.7,
      },
    },
  ];

  const layout = {
    title: {
      text:
        timeSliderValue === 0
          ? 'Live Volatility Surface'
          : `Volatility Surface (${Math.round(
              timeSliderValue
            )} min ago)`,
      font: {
        size: 16,
        color: '#fff',
      },
    },

    scene: {
      xaxis: {
        title:
          'Log-Moneyness k = ln(K/F)',
        titlefont: {
          color: '#fff',
        },
        tickfont: {
          color: '#fff',
        },
        backgroundcolor:
          'rgba(20,20,30,0.9)',
        gridcolor: '#444',
      },

      yaxis: {
        title:
          'Time to Expiry (hours)',
        titlefont: {
          color: '#fff',
        },
        tickfont: {
          color: '#fff',
        },
        backgroundcolor:
          'rgba(20,20,30,0.9)',
        gridcolor: '#444',
      },

      zaxis: {
        title:
          'Implied Volatility %',
        titlefont: {
          color: '#fff',
        },
        tickfont: {
          color: '#fff',
        },
        backgroundcolor:
          'rgba(20,20,30,0.9)',
        gridcolor: '#444',
      },

      camera: {
        eye: {
          x: 1.5,
          y: 1.5,
          z: 1.3,
        },
      },
    },

    paper_bgcolor:
      'rgba(30,30,40,1)',

    plot_bgcolor:
      'rgba(30,30,40,1)',

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
        <h2>
          Volatility Surface Studio
        </h2>
      </div>

      <div className="plot-container">
        <Plot
          data={plotData}
          layout={layout}
          config={{
            responsive: true,
            displayModeBar: true,
            displaylogo: false,

            toImageButtonOptions: {
              format: 'png',
              filename:
                'volatility_surface',
              height: 800,
              width: 1200,
              scale: 2,
            },
          }}
        />
      </div>

      <div className="time-slider-container">

        <div className="slider-header">
          <label>
            Surface Timeline
          </label>

          <span className="slider-time">
            {timeSliderValue === 0
              ? 'Live'
              : `${Math.round(
                  timeSliderValue
                )} min ago`}
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="10080"
          value={timeSliderValue}
          onChange={(e) =>
            setTimeSliderValue(
              Number(e.target.value)
            )
          }
          className="slider-input"
        />

        <div className="slider-labels">
          <span>Live</span>
          <span>4h Ago</span>
        </div>

      </div>

    </div>
  );
}