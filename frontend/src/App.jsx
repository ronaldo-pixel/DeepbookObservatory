/**
 * Main Application Component
 */

import React, { useState, useEffect } from 'react';
import { useSurfaceData } from './hooks/useSurfaceData';
import { HistorySurface } from './components/HistorySurface';
import { LiveSurface } from './components/LiveSurface';
import { SurfaceAnalysis } from './components/SurfaceAnalysis';
import { OracleHealthPanel } from './components/OracleHealthPanel';
import { OracleSmileViewer } from './components/OracleSmileViewer';
import { getLiveSurface } from './utils/sviMath';

function App() {
  const {
    oracles,
    historyCache,
    loading: oraclesLoading,
    error: oraclesError,
  } = useSurfaceData();

  const [liveSurface, setLiveSurface] = useState(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveRefreshing, setLiveRefreshing] = useState(false);
  const [liveRevision, setLiveRevision] = useState(0);
  const [selectedOracleId, setSelectedOracleId] = useState(null);

  // Poll for Live Volatility Surface data
  useEffect(() => {
    if (!oracles || oracles.length === 0) {
      return;
    }

    let cancelled = false;

    const fetchSurface = async (initial = false) => {
      try {
        if (!initial) {
          setLiveRefreshing(true);
        }

        const result = await getLiveSurface(oracles);

        if (!cancelled && result) {
          setLiveSurface(result);
          setLiveRevision(prev => prev + 1);
        }
      } catch (err) {
        console.error('Live surface error:', err);
      } finally {
        if (!cancelled) {
          setLiveLoading(false);
          setLiveRefreshing(false);
        }
      }
    };

    // Initial load
    fetchSurface(true);

    // Refresh every 20 seconds
    const interval = setInterval(() => {
      fetchSurface(false);
    }, 20000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [oracles]);

  // Auto-select first active oracle when data becomes available
  useEffect(() => {
    if (liveSurface?.oracleHealth?.length > 0 && !selectedOracleId) {
      setSelectedOracleId(liveSurface.oracleHealth[0].oracle_id);
    }
  }, [liveSurface, selectedOracleId]);

  const error = oraclesError;
  const loading = oraclesLoading;

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-title">
            <h1>DeepBook Observatory</h1>
            <p>Real-time volatility analytics</p>
          </div>

          {/* Status Indicator */}
          <div className="header-status">
            {loading ? (
              <>
                <div className="status-dot connecting"></div>
                <span className="status-text connecting">Connecting...</span>
              </>
            ) : error ? (
              <>
                <div className="status-dot error"></div>
                <span className="status-text error">{error}</span>
              </>
            ) : (
              <>
                <div className="status-dot connected"></div>
                <span className="status-text connected">Connected</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        
        {/* Volatility Regime & Arbitrage Analysis (Always Visible) */}
        <SurfaceAnalysis 
          analysis={liveSurface?.analysis} 
          loading={liveLoading} 
        />
        
        {/* Interactive Volatility Surfaces Container */}
        <div className="surfaces-container">
          <LiveSurface 
            liveSurface={liveSurface}
            loading={liveLoading}
            refreshing={liveRefreshing}
            revision={liveRevision}
          />
          <HistorySurface 
            oracles={oracles} 
            historyCache={historyCache} 
          />
        </div>

        {/* Selected Oracle Volatility Smile & Parameters Detail */}
        <OracleSmileViewer
          oracleHealth={liveSurface?.oracleHealth}
          ks={liveSurface?.ks}
          selectedOracleId={selectedOracleId}
          onSelectOracle={setSelectedOracleId}
        />

        {/* Oracle Feed Health & Latency panel */}
        <OracleHealthPanel 
          oracleHealth={liveSurface?.oracleHealth} 
          selectedOracleId={selectedOracleId}
          onSelectOracle={setSelectedOracleId}
        />
     
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>DeepBook Observatory • Real-time volatility surface powered by Sui</p>
      </footer>
    </div>
  );
}

export default App;
