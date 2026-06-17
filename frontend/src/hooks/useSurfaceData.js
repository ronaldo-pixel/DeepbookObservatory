/**
 * Hook for fetching surface data and subscribing to Sui events
 * Uses official Sui RPC event streaming
 */

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const PREDICT_SERVER = process.env.REACT_APP_PREDICT_SERVER || 'https://predict-server.testnet.mystenlabs.com';
const PREDICT_ID = process.env.REACT_APP_PREDICT_ID || '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a';
const PREDICT_PACKAGE = process.env.REACT_APP_PREDICT_PACKAGE || '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138';

// Sui RPC endpoints



export function useSurfaceData() {
  const [oracles, setOracles] = useState(null); // All oracles
  const [oracleHistory, setOracleHistory] = useState(new Map()); // Historical price/SVI data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

 


  // Step 1: Fetch oracle list on startup
  useEffect(() => {
    const fetchOracles = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await axios.get(
          `${PREDICT_SERVER}/predicts/${PREDICT_ID}/oracles`
        );

        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

        setOracles(response.data
          .map((o) => ({
            oracle_id: o.oracle_id,
            activated_at: o.activated_at,
            expiry: Number(o.expiry),
            settled_at: o.settled_at,
          }))
          .filter((o) => o.expiry > sevenDaysAgo)
          .sort((a, b) => a.expiry - b.expiry));

        setLoading(false);
        
      } catch (err) {
        console.error('Failed to fetch oracles:', err);
        setError('Failed to fetch oracle list');
      }
    };

    fetchOracles();
  }, []);


  


  /*
  // Step 4: Subscribe to events via WebSocket RPC
  useEffect(() => {
    if (!activeOracles || activeOracles.size === 0) return;

    let ws = null;
    let subscriptionId = null;

    const connectAndSubscribe = () => {
      try {
        ws = new WebSocket(SUI_RPC_WS);

        ws.onopen = () => {
          console.log('Connected to Sui RPC WebSocket');

          // Subscribe to OracleSVIUpdated events
          const request = {
            jsonrpc: '2.0',
            id: 1,
            method: 'sui_subscribeEvent',
            params: [
              {
                filter: {
                  MoveEventType: `${PREDICT_PACKAGE}::oracle::OracleSVIUpdated`,
                },
              },
            ],
          };

          ws.send(JSON.stringify(request));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // Handle subscription confirmation
            if (data.result && !subscriptionId) {
              subscriptionId = data.result;
              console.log('Subscription established:', subscriptionId);

              // Also subscribe to price updates
              const priceRequest = {
                jsonrpc: '2.0',
                id: 2,
                method: 'sui_subscribeEvent',
                params: [
                  {
                    filter: {
                      MoveEventType: `${PREDICT_PACKAGE}::oracle::OraclePricesUpdated`,
                    },
                  },
                ],
              };
              ws.send(JSON.stringify(priceRequest));
              return;
            }

            // Handle event notifications
            if (data.params?.result?.event) {
              const evt = data.params.result.event;
              processEvent(evt);
            }
          } catch (err) {
            console.error('Error processing WebSocket message:', err);
          }
        };

        ws.onerror = (err) => {
          console.error('WebSocket error:', err);
        };

        ws.onclose = () => {
          console.log('WebSocket closed, reconnecting in 3s...');
          setTimeout(connectAndSubscribe, 3000);
        };

        wsRef.current = ws;
      } catch (err) {
        console.error('WebSocket connection error:', err);
        setTimeout(connectAndSubscribe, 3000);
      }
    };

    connectAndSubscribe();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [activeOracles]);

  // Process single event and update oracle data
  const processEvent = (event) => {
    try {
      const eventType = event.type || '';
      let oracleId;

      // Parse event based on type
      if (eventType.includes('OraclePricesUpdated')) {
        const parsedJson = event.parsedJson || {};
        oracleId = parsedJson.oracle_id;
        
        setActiveOracles((prev) => {
          const updated = new Map(prev);
          if (oracleId && updated.has(oracleId)) {
            const oracle = updated.get(oracleId);
            oracle.price = {
              spot: Number(parsedJson.spot || 0),
              forward: Number(parsedJson.forward || 0),
              timestamp: Number(parsedJson.timestamp || Date.now()),
            };
          }
          return updated;
        });
      } else if (eventType.includes('OracleSVIUpdated')) {
        const parsedJson = event.parsedJson || {};
        oracleId = parsedJson.oracle_id;

        setActiveOracles((prev) => {
          const updated = new Map(prev);
          if (oracleId && updated.has(oracleId)) {
            const oracle = updated.get(oracleId);
            oracle.svi = {
              a: Number(parsedJson.a || 0),
              b: Number(parsedJson.b || 0),
              rho: Number(parsedJson.rho || 0),
              m: Number(parsedJson.m || 0),
              sigma: Number(parsedJson.sigma || 0),
              timestamp: Number(parsedJson.timestamp || Date.now()),
            };
          }
          return updated;
        });
      }
    } catch (err) {
      console.error('Error processing event:', err);
    }
  };
  */


  return {
    oracles,
    loading,
    error,
  };
}
