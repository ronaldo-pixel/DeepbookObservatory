/**
 * Hook for fetching surface data and subscribing to Sui events
 * Uses official Sui RPC event streaming
 */

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { SuiGraphQLClient } from '@mysten/sui/graphql';

const graphqlClient = new SuiGraphQLClient({
  url: 'https://graphql.testnet.sui.io/graphql',
  network: 'testnet',
});

const PREDICT_SERVER = process.env.REACT_APP_PREDICT_SERVER || 'https://predict-server.testnet.mystenlabs.com';
const PREDICT_ID = process.env.REACT_APP_PREDICT_ID || '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a';
const PREDICT_PACKAGE = process.env.REACT_APP_PREDICT_PACKAGE || '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138';

// Sui RPC endpoints



export function useSurfaceData() {
  const [oracles, setOracles] = useState(null); // All oracles
  const [oracleHistory, setOracleHistory] = useState(new Map()); // Historical price/SVI data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const historyCache = useRef(new Map());


 


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

  const handleOracleActivated = (parsed) => {
    const { oracle_id, expiry, timestamp } = parsed;

    setOracles((prev) => {
      const already = prev.find((o) => o.oracle_id === oracle_id);
      if (already) return prev;

      const newOracle = {
        oracle_id,
        activated_at: Number(timestamp),
        expiry: Number(expiry),
        settled_at: null,
      };
      console.log('New oracle activated:', newOracle);

      let lo = 0, hi = prev.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (prev[mid].expiry < newOracle.expiry) lo = mid + 1;
        else hi = mid;
      }

      const updated = [...prev];
      updated.splice(lo, 0, newOracle);
      return updated;
    });
  };

  const handleOracleSettled = async (parsed) => {
    const { oracle_id, timestamp } = parsed;

    const [pricesRes, sviRes] = await Promise.all([
      axios.get(`${PREDICT_SERVER}/oracles/${oracle_id}/prices`),
      axios.get(`${PREDICT_SERVER}/oracles/${oracle_id}/svi`),
    ]);
    console.log(`Oracle ${oracle_id} settled.`);

    const prices = (pricesRes.data || [])
      .map((p) => ({ spot: p.spot, forward: p.forward, onchain_timestamp: p.onchain_timestamp }))
      .sort((a, b) => a.onchain_timestamp - b.onchain_timestamp);

    const svi = (sviRes.data || [])
      .map((s) => ({ a: s.a, b: s.b, rho: s.rho, rho_negative: s.rho_negative, m: s.m, m_negative: s.m_negative, sigma: s.sigma, onchain_timestamp: s.onchain_timestamp }))
      .sort((a, b) => a.onchain_timestamp - b.onchain_timestamp);

    historyCache.current.set(oracle_id, { oracle_id, prices, svi });

    setOracles((prev) => {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

      const updated = prev.map((o) =>
        o.oracle_id === oracle_id ? { ...o, settled_at: Number(timestamp) } : o
      );

      let start = 0;
      while (start < updated.length && updated[start].expiry <= sevenDaysAgo) {
        historyCache.current.delete(updated[start].oracle_id);
        start++;
      }

      return start === 0 ? updated : updated.slice(start);
    });
  };


  const activatedCursorRef = useRef(null);
  const settledCursorRef = useRef(null);

  useEffect(() => {
    const pollEvents = async () => {
      console.log('polling...');

      const [activatedResult, settledResult] = await Promise.all([
        graphqlClient.query({
          query: `
            query PollActivated($after: String) {
              events(
                filter: { type: "${PREDICT_PACKAGE}::oracle::OracleActivated" }
                after: $after
                first: 50
              ) {
                pageInfo { endCursor }
                nodes { contents { json } }
              }
            }
          `,
          variables: { after: activatedCursorRef.current },
        }),

        graphqlClient.query({
          query: `
            query PollSettled($after: String) {
              events(
                filter: { type: "${PREDICT_PACKAGE}::oracle::OracleSettled" }
                after: $after
                first: 50
              ) {
                pageInfo { endCursor }
                nodes { contents { json } }
              }
            }
          `,
          variables: { after: settledCursorRef.current },
        }),
      ]);

      for (const event of activatedResult.data?.events?.nodes || []) {
        handleOracleActivated(event.contents.json);
      }

      for (const event of settledResult.data?.events?.nodes || []) {
        handleOracleSettled(event.contents.json);
      }

      const activatedCursor =
        activatedResult.data?.events?.pageInfo?.endCursor;

      const settledCursor =
        settledResult.data?.events?.pageInfo?.endCursor;

      if (activatedCursor) {
        activatedCursorRef.current = activatedCursor;
      }

      if (settledCursor) {
        settledCursorRef.current = settledCursor;
      }

      console.log('activated cursor:', activatedCursorRef.current);
      console.log('settled cursor:', settledCursorRef.current);
    };

    const init = async () => {
      const [activatedInit, settledInit] = await Promise.all([
        graphqlClient.query({
          query: `
            query InitActivatedCursor {
              events(
                filter: { type: "${PREDICT_PACKAGE}::oracle::OracleActivated" }
                last: 1
              ) {
                pageInfo { endCursor }
              }
            }
          `,
        }),

        graphqlClient.query({
          query: `
            query InitSettledCursor {
              events(
                filter: { type: "${PREDICT_PACKAGE}::oracle::OracleSettled" }
                last: 1
              ) {
                pageInfo { endCursor }
              }
            }
          `,
        }),
      ]);

      activatedCursorRef.current =
        activatedInit.data?.events?.pageInfo?.endCursor ?? null;

      settledCursorRef.current =
        settledInit.data?.events?.pageInfo?.endCursor ?? null;

      console.log('initialized activated cursor:', activatedCursorRef.current);
      console.log('initialized settled cursor:', settledCursorRef.current);
    };

    let interval;

    init().then(() => {
      interval = setInterval(pollEvents, 10 * 60 * 1000);
    });

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);


  

  return {
    oracles,
    historyCache,
    loading,
    error,
  };
}
