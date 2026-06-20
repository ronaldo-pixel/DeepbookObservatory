/**
 * Main Application Component
 */

import React, { useState, useEffect, useRef } from 'react';
import { useSurfaceData } from './hooks/useSurfaceData';
import { HistorySurface } from './components/HistorySurface';
import { LiveSurface } from './components/LiveSurface';
import { SurfaceAnalysis } from './components/SurfaceAnalysis';
import { OracleHealthPanel } from './components/OracleHealthPanel';
import { OracleSmileViewer } from './components/OracleSmileViewer';
import { TermStructure } from './components/TermStructure';
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
  
  // Navigation: 'live' or 'history'
  const [activeTab, setActiveTab] = useState('surface');

  // Alert dropdown state
  const [showAlertDropdown, setShowAlertDropdown] = useState(false);
  const alertRef = useRef(null);

  // Close alert dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (alertRef.current && !alertRef.current.contains(event.target)) {
        setShowAlertDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Dynamic alert calculation
  // Each alert carries: type, severity, message, targetTab ('live'|'history'), targetId (DOM element id to scroll to)
  const activeAlerts = [];

  if (liveSurface?.analysis) {
    const { regime, calendarViolations, butterflyViolations } = liveSurface.analysis;

    // 1. Volatility Regime Alert → goes to live page, surface-analysis section
    if (regime?.regime && regime.regime !== 'normal') {
      activeAlerts.push({
        type: 'regime',
        severity: regime.regime === 'extreme' ? 'critical' : 'warning',
        message: `Volatility Regime is ${regime.regime.toUpperCase()}: ATM IV at ${regime.frontATMIV}% (Slope: ${regime.slope}%)`,
        targetTab: 'surface',
        targetId: 'section-surface-analysis',
      });
    }

    // 2. Calendar Violations Alert → goes to live page, surface-analysis section
    if (calendarViolations?.length > 0) {
      activeAlerts.push({
        type: 'calendar',
        severity: 'critical',
        message: `Calendar Spread Arbitrage: ${calendarViolations.length} spread violations detected.`,
        targetTab: 'surface',
        targetId: 'section-surface-analysis',
      });
    }

    // 3. Butterfly Violations Alert → goes to live page, surface-analysis section
    if (butterflyViolations?.length > 0) {
      activeAlerts.push({
        type: 'butterfly',
        severity: 'critical',
        message: `Butterfly Spread Arbitrage: ${butterflyViolations.length} negative density violations detected.`,
        targetTab: 'surface',
        targetId: 'section-surface-analysis',
      });
    }

    // Future alerts: push { type, severity, message, targetTab, targetId } here.
    // targetId must match an id= attribute on a DOM element in the rendered page.
  }

  // Navigate to the alert's target tab then scroll to its anchor element
  function handleAlertClick(alert) {
    setShowAlertDropdown(false);
    // If we're already on the right tab, scroll immediately; otherwise switch tab then scroll after paint
    if (activeTab === alert.targetTab) {
      document.getElementById(alert.targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      setActiveTab(alert.targetTab);
      // Wait for the new tab's DOM to render before scrolling
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.getElementById(alert.targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }
  }

  const error = oraclesError;
  const loading = oraclesLoading;

  return (
    <div className="app">
      {/* Header & Nav Bar */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <div className="header-title">
              <h1>DeepBook Observatory</h1>
              <p>Real-time volatility analytics</p>
            </div>
            
            {/* Top Navigation Bar */}
            <nav className="nav-tabs">
              <button
                onClick={() => setActiveTab('surface')}
                className={`nav-tab-btn ${activeTab === 'surface' ? 'active' : ''}`}
              >
                Surface Dashboard
              </button>

              <button
                onClick={() => setActiveTab('oracle')}
                className={`nav-tab-btn ${activeTab === 'oracle' ? 'active' : ''}`}
              >
                Oracle Dashboard
              </button>
            </nav>
          </div>

          <div className="header-right">
            {/* Alerts Bell Icon & Dropdown */}
            <div className="alerts-container" ref={alertRef}>
              <button 
                className={`alerts-bell-btn ${activeAlerts.length > 0 ? 'has-alerts' : ''}`}
                onClick={() => setShowAlertDropdown(prev => !prev)}
                title="System Alerts"
              >
                🔔
                {activeAlerts.length > 0 && (
                  <span className="alerts-badge">
                    {activeAlerts.length}
                  </span>
                )}
              </button>
              
              {showAlertDropdown && (
                <div className="alerts-dropdown">
                  <h4>Active System Alerts</h4>
                  {activeAlerts.length === 0 ? (
                    <div className="alert-item normal">
                      ✓ All systems normal. No active anomalies.
                    </div>
                  ) : (
                    <div className="alerts-list">
                      {activeAlerts.map((alert, idx) => (
                        <div
                          key={idx}
                          className={`alert-item ${alert.severity} clickable`}
                          onClick={() => handleAlertClick(alert)}
                          title="Click to navigate to this section"
                        >
                          <span className="alert-severity-badge">
                            {alert.severity === 'critical' ? '▲ CRITICAL' : '● WARNING'}
                          </span>
                          <span className="alert-message">{alert.message}</span>
                          <span className="alert-navigate-hint">→ Go to section</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Connection Status Indicator */}
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
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        
        {activeTab === 'surface' ? (
          <>
            {/* Surface Analysis — anchor id for alert navigation */}
            <div id="section-surface-analysis">
              <SurfaceAnalysis
                analysis={liveSurface?.analysis}
                oracleHealth={liveSurface?.oracleHealth}
                loading={liveLoading}
              />
            </div>

            {/* Live + Historical Side-by-Side */}
            <div className="surface-dashboard-grid">
              <div className="surface-panel">
                <LiveSurface
                  liveSurface={liveSurface}
                  loading={liveLoading}
                  refreshing={liveRefreshing}
                  revision={liveRevision}
                />
              </div>

              <div className="surface-panel">
                <HistorySurface
                  oracles={oracles}
                  historyCache={historyCache}
                />
              </div>
            </div>

            {/* Term Structure Chart */}
            <TermStructure
              oracleHealth={liveSurface?.oracleHealth}
              loading={liveLoading}
            />
          </>
        ) : (
          <>
            {/* Oracle Smile — anchor id for alert navigation */}
            <div id="section-oracle-smile">
              <OracleSmileViewer
                oracleHealth={liveSurface?.oracleHealth}
                ks={liveSurface?.ks}
                selectedOracleId={selectedOracleId}
                onSelectOracle={setSelectedOracleId}
              />
            </div>

            {/* Oracle Health — anchor id for alert navigation */}
            <div id="section-oracle-health">
              <OracleHealthPanel
                oracleHealth={liveSurface?.oracleHealth}
                selectedOracleId={selectedOracleId}
                onSelectOracle={setSelectedOracleId}
              />
            </div>
          </>
        )}
     
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>DeepBook Observatory • Real-time volatility surface powered by Sui</p>
      </footer>
    </div>
  );
}

export default App;
