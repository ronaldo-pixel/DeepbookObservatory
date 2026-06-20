import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Dot
} from 'recharts';
import { calculateTimeToExpiry, calculateImpliedVolatility } from '../utils/sviMath';

// Helper to format time differences to user-friendly labels (e.g. 15m, 1h, 4h, 1d)
function formatTimeDifference(ms) {
  if (ms <= 0) return '0s';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

// Custom Tooltip component for a polished dark-mode aesthetic
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid #374151',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(12px)',
          color: '#fff',
          fontSize: '0.85rem',
          lineHeight: '1.5'
        }}
      >
        <div style={{ color: '#9ca3af', marginBottom: '4px' }}>
          Expiry: <strong style={{ color: '#fff' }}>{new Date(data.expiry).toLocaleString()}</strong>
        </div>
        <div style={{ color: '#9ca3af', marginBottom: '4px' }}>
          Time to Expiry: <strong style={{ color: '#fff' }}>{data.expiryLabel}</strong>
        </div>
        <div style={{ color: '#3b82f6', fontWeight: 'bold', fontSize: '0.95rem' }}>
          ATM IV: {data.atmIV.toFixed(2)}%
        </div>
      </div>
    );
  }
  return null;
};

export function TermStructure({ oracleHealth, loading }) {
  if (loading) {
    return (
      <div className="term-structure-container" style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
        <p>Loading Term Structure...</p>
      </div>
    );
  }

  if (!oracleHealth || oracleHealth.length === 0) {
    return (
      <div className="term-structure-container" style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
        <p>No active oracle data available for Term Structure.</p>
      </div>
    );
  }

  oracleHealth = oracleHealth.filter(oracle => oracle.status === "HEALTHY");

  // Calculate ATM IV (implied vol at k=0) for each oracle and sort by expiry
  const now = Date.now();
  const data = oracleHealth
    .map((oracle) => {
      const T = calculateTimeToExpiry(oracle.expiry, now);
      const atmIV = T > 0 && oracle.sviParams ? calculateImpliedVolatility(0, T, oracle.sviParams) * 100 : 0;
      const diffMs = oracle.expiry - now;
      return {
        expiry: oracle.expiry,
        expiryLabel: formatTimeDifference(diffMs),
        atmIV,
        diffMs
      };
    })
    .filter((item) => item.atmIV > 0 && item.diffMs > 0)
    .sort((a, b) => a.expiry - b.expiry);

  if (data.length === 0) {
    return (
      <div className="term-structure-container" style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
        <p>Insufficient SVI parameter data to construct Term Structure.</p>
      </div>
    );
  }

  return (
    <div 
      className="term-structure-card"
      style={{
        background: 'rgba(17, 24, 39, 0.45)',
        backdropFilter: 'blur(12px)',
        border: '1px solid #374151',
        borderRadius: '8px',
        padding: '1.5rem',
        marginTop: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #374151', paddingBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 'bold', margin: 0 }}>
          ATM Implied Volatility Term Structure
        </h3>
        <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
          ATM IV (k = 0) vs. Expiry
        </span>
      </div>

      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 15, right: 20, left: -10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" />
            <XAxis 
              dataKey="expiryLabel" 
              stroke="#9ca3af"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={{ stroke: '#374151' }}
            />
            <YAxis 
              stroke="#9ca3af"
              tickFormatter={(v) => `${v.toFixed(0)}%`}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={{ stroke: '#374151' }}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="atmIV"
              stroke="#10b981"
              strokeWidth={3}
              activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
              dot={(props) => {
                const { cx, cy, payload } = props;
                return (
                  <Dot
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill="#10b981"
                    stroke="#111827"
                    strokeWidth={1.5}
                    key={`dot-${payload.expiry}`}
                  />
                );
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
