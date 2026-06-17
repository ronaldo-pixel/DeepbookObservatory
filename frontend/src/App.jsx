/**
 * Main Application Component
 */

import React from 'react';
import { useSurfaceData } from './hooks/useSurfaceData';
import { SurfaceStudio } from './components/SurfaceStudio';

function App() {
  const {
    oracles,
    loading,
    error,
  } = useSurfaceData();

 

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
        {/* Oracle Selector */}
        
        
          <SurfaceStudio
            oracles={oracles}
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
