import axios from "axios";

/**
 * SVI (Stochastic Volatility Inspired) Math Utilities
 */

const SVI_SCALE = 1e9;
const PREDICT_SERVER = process.env.REACT_APP_PREDICT_SERVER || 'https://predict-server.testnet.mystenlabs.com';


/**
 * Convert raw oracle SVI params into usable decimals
 */
export function normalizeSVI(svi) {
  return {
    a: svi.a / SVI_SCALE,
    b: svi.b / SVI_SCALE,
    rho:
      (svi.rho_negative ? -1 : 1) *
      (svi.rho / SVI_SCALE),
    m:
      (svi.m_negative ? -1 : 1) *
      (svi.m / SVI_SCALE),
    sigma: svi.sigma / SVI_SCALE,
  };
}


/**
 * SVI total variance
 *
 * w(k) = a + b * (rho * (k - m) + sqrt((k - m)^2 + sigma^2))
 */
export function calculateTotalVariance(k, sviParams) {
  const { a, b, rho, m, sigma } = normalizeSVI(sviParams);

  const kMinusM = k - m;
  const sqrtTerm = Math.sqrt(
    kMinusM * kMinusM + sigma * sigma
  );

  const w =
    a +
    b *
      (
        rho * kMinusM +
        sqrtTerm
      );

  return Math.max(w, 0);
}


/**
 * IV = sqrt(w / T)
 */
export function calculateImpliedVolatility(
  k,
  T,
  sviParams
) {
  if (T <= 0) return 0;

  const w = calculateTotalVariance(
    k,
    sviParams
  );

  return Math.sqrt(w / T);
}


export function generateKGrid(numPoints = 30) {
  const kMin = -0.3;
  const kMax = 0.3;

  const ks = [];

  for (let i = 0; i < numPoints; i++) {
    ks.push(
      kMin +
        (kMax - kMin) *
          (i / (numPoints - 1))
    );
  }

  return ks;
}


/**
 * Time to expiry in years
 */
export function calculateTimeToExpiry(
  expiryTimestamp,
  referenceTimestamp = Date.now()
) {
  const timeToExpiryMs =
    expiryTimestamp -
    referenceTimestamp;

  if (timeToExpiryMs <= 0) {
    return 0;
  }

  return (
    timeToExpiryMs /
    (365.25 *
      24 *
      60 *
      60 *
      1000)
  );
}

export async function getHistoricalSurface(
  oracles,
  timeSliderValue,
  historyCache,
  signal,
  numPoints = 30
) {
  const activeOracles =
    getActiveOraclesAtTime(
      oracles,
      timeSliderValue
    );

  if (
    activeOracles.length === 0
  ) {
    return null;
  }

  // console.log(activeOracles);

  const histories =
    await fetchOracleHistories(
      activeOracles,
      historyCache,
      signal
    );
  
  // console.log(historyCache);
  
  return buildHistoricalSurface(
    activeOracles,
    histories,
    timeSliderValue,
    numPoints
  );
}


/**
 * Compute oracle health from the last 5 SVI entries (already fetched).
 * sviHistory is ordered desc — index 0 is most recent.
 */
export function computeOracleHealth(oracle, sviHistory) {
  const now = Date.now();

  if (!sviHistory || sviHistory.length === 0) {
    return { status: 'UNKNOWN', lag: null, avgInterval: null };
  }

  const lag = now - sviHistory[0].onchain_timestamp;

  let avgInterval = null;
  if (sviHistory.length >= 2) {
    const intervals = [];
    for (let i = 0; i < sviHistory.length - 1; i++) {
      intervals.push(sviHistory[i].onchain_timestamp - sviHistory[i + 1].onchain_timestamp);
    }
    avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  }

  const timeToExpiry = oracle.expiry - now;
  const SLOW_THRESHOLD = Math.max(3 * avgInterval, 60_000)   // at least 1 min
  const STALE_THRESHOLD = Math.max(5 * avgInterval, 180_000) // at least 3 min


  let status;
  if (avgInterval === null) {
    status = 'UNKNOWN';
  } else if (timeToExpiry < 5 * 60 * 1000 && lag > 60_000) {
    status = 'CRITICAL';
  } else if (lag > STALE_THRESHOLD) {
    status = 'STALE';
  } else if (lag > SLOW_THRESHOLD) {
    status = 'SLOW';
  } else {
    status = 'HEALTHY';
  }

  return { status, lag, avgInterval, timeToExpiry };
}

export async function getLiveSurface(oracles, numPoints = 30) {
  const now = Date.now();
  const activeOracles = getActiveOraclesAtTime(oracles, 0);

  if (activeOracles.length === 0) return null;

  const histories = await Promise.all(
    activeOracles.map(async (oracle) => {
      const [pricesRes, sviRes] = await Promise.all([
        axios.get(`${PREDICT_SERVER}/oracles/${oracle.oracle_id}/prices?limit=5`),
        axios.get(`${PREDICT_SERVER}/oracles/${oracle.oracle_id}/svi?limit=5`),
      ]);
      return {
        oracle_id: oracle.oracle_id,
        prices: pricesRes.data || [],
        svi: sviRes.data || [],
      };
    })
  );

  const ks = generateKGrid(numPoints);
  const surfaceData = [];
  const expiryTimes = [];
  const sviSnapshots = []; // collect for analysis
  const oracleHealth = [];  // health per oracle

  for (let i = 0; i < activeOracles.length; i++) {
    const oracle = activeOracles[i];
    const history = histories[i];
    const sviSnapshot = history.svi[0];
    if (!sviSnapshot) continue;

    const T = calculateTimeToExpiry(oracle.expiry, now);
    if (T <= 0) continue;

    expiryTimes.push(T * 365.25 * 24);
    surfaceData.push(ks.map((k) => calculateImpliedVolatility(k, T, sviSnapshot) * 100));
    sviSnapshots.push(sviSnapshot);
    oracleHealth.push({
      oracle_id: oracle.oracle_id,
      expiry: oracle.expiry,
      sviParams: sviSnapshot,
      prevSviParams: history.svi[1] || null,
      latestPrice: history.prices[0] || null,
      prevPrice: history.prices[1] || null,
      ...computeOracleHealth(oracle, history.svi),
    });
  }

  if (surfaceData.length === 0) return null;

  // Run analysis
  const calendarViolations = checkCalendarViolations(activeOracles, sviSnapshots);
  const butterflyViolations = checkButterflyViolations(activeOracles, sviSnapshots);
  const regime = detectRegime(activeOracles, sviSnapshots);

  return {
    ks,
    expiryTimes,
    surfaceData,
    oracleHealth,
    analysis: { calendarViolations, butterflyViolations, regime },
  };
}


export function getActiveOraclesAtTime(
  oracles,
  timeSliderValue
) {
  if (
    !oracles ||
    oracles.length === 0
  ) {
    return [];
  }

  const targetTime =
    Date.now() -
    timeSliderValue * 60 * 1000;

  const firstValidOracleIndex =
    findFirstExpiryAfter(
      oracles,
      targetTime
    );

  if (
    firstValidOracleIndex === -1
  ) {
    return [];
  }

  const activeOracles = [];

  for (
    let i = firstValidOracleIndex;
    i < oracles.length;
    i++
  ) {
    const oracle = oracles[i];

    if (
      oracle.activated_at >
      targetTime
    ) {
      continue;
    }

    activeOracles.push(
      oracle
    );
  }

  return activeOracles;
}

async function fetchOracleHistories(activeOracles, historyCache, signal) {
  const histories = await Promise.all(
    activeOracles.map(async (oracle) => {
      const cached = historyCache.current.get(oracle.oracle_id);
      if (cached && oracle.settled_at != null) return cached; // only trust cache if settled

      const [pricesRes, sviRes] = await Promise.all([
        axios.get(`${PREDICT_SERVER}/oracles/${oracle.oracle_id}/prices`, { signal }),
        axios.get(`${PREDICT_SERVER}/oracles/${oracle.oracle_id}/svi`, { signal }),
      ]);

      const prices = (pricesRes.data || [])
        .map((p) => ({ spot: p.spot, forward: p.forward, onchain_timestamp: p.onchain_timestamp }))
        .sort((a, b) => a.onchain_timestamp - b.onchain_timestamp);

      const svi = (sviRes.data || [])
        .map((s) => ({ a: s.a, b: s.b, rho: s.rho, rho_negative: s.rho_negative, m: s.m, m_negative: s.m_negative, sigma: s.sigma, onchain_timestamp: s.onchain_timestamp }))
        .sort((a, b) => a.onchain_timestamp - b.onchain_timestamp);

      const result = { oracle_id: oracle.oracle_id, prices, svi };

      if (oracle.settled_at != null) {
        historyCache.current.set(oracle.oracle_id, result); // only cache settled
      }

      return result;
    })
  );

  return histories;
}


function buildHistoricalSurface(
  activeOracles,
  histories,
  timeSliderValue,
  numPoints = 30
) {
  if (
    !activeOracles ||
    activeOracles.length === 0
  ) {
    return null;
  }

  const targetTime =
    Date.now() -
    timeSliderValue * 60 * 1000;

  const ks =
    generateKGrid(numPoints);

  const surfaceData = [];
  const expiryTimes = [];

  for (
    let i = 0;
    i < activeOracles.length;
    i++
  ) {
    const oracle =
      activeOracles[i];

    const history =
      histories[i];

    if (!history) {
      continue;
    }

    const sviSnapshot =
      findLatestBefore(
        history.svi,
        targetTime
      );

    if (!sviSnapshot) {
      continue;
    }

    const T =
      calculateTimeToExpiry(
        oracle.expiry,
        targetTime
      );

    if (T <= 0) {
      continue;
    }

    expiryTimes.push(
      T * 365.25 * 24
    );

    surfaceData.push(
      ks.map(
        (k) =>
          calculateImpliedVolatility(
            k,
            T,
            sviSnapshot
          ) * 100
      )
    );
  }

  if (
    surfaceData.length === 0
  ) {
    return null;
  }

  return {
    ks,
    expiryTimes,
    surfaceData,
  };
}

/**
 * Returns the index of the first oracle
 * whose expiry is > targetTime.
 */
function findFirstExpiryAfter(
  sortedOracles,
  targetTime
) {
  let left = 0;
  let right =
    sortedOracles.length - 1;
  let result = -1;

  while (left <= right) {
    const mid = Math.floor(
      (left + right) / 2
    );

    if (
      sortedOracles[mid]
        .expiry > targetTime
    ) {
      result = mid;
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return result;
}

/**
 * Returns the latest snapshot
 * with timestamp <= targetTime.
 */
function findLatestBefore(
  sortedArray,
  targetTime
) {
  if (
    !sortedArray ||
    sortedArray.length === 0
  ) {
    return null;
  }

  let left = 0;
  let right =
    sortedArray.length - 1;
  let result = null;

  while (left <= right) {
    const mid = Math.floor(
      (left + right) / 2
    );

    const item =
      sortedArray[mid];

    if (
      item.onchain_timestamp <=
      targetTime
    ) {
      result = item;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return result;
}


/**
 * Calendar Spread Violation Check
 * Total variance w(k) must increase with expiry for same k.
 * If w(k, T1) > w(k, T2) for T1 < T2, that's a violation.
 * activeOracles must be sorted by expiry (they already are).
 */
export function checkCalendarViolations(activeOracles, sviSnapshots) {
  const violations = [];

  const ks = generateKGrid(30);

  for (let i = 0; i < activeOracles.length - 1; i++) {
    const svi1 = sviSnapshots[i];
    const svi2 = sviSnapshots[i + 1];

    if (!svi1 || !svi2) continue;

    for (const k of ks) {
      const w1 = calculateTotalVariance(k, svi1);
      const w2 = calculateTotalVariance(k, svi2);

      if (w1 > w2) {
        violations.push({
          k: k.toFixed(3),
          expiry1: activeOracles[i].expiry,
          expiry2: activeOracles[i + 1].expiry,
        });
        break; // one violation per expiry pair is enough
      }
    }
  }

  return violations;
}

/**
 * Butterfly Violation Check
 * Local vol must be non-negative everywhere.
 * Condition: 1 - (k*g'(k))/(2*g(k)) - (g'(k)^2)/(4*(1/4 + 1/g(k))) >= 0
 * where g(k) = w(k) / T
 * Simplified: check d²w/dk² >= 0 and density condition at each k.
 */
export function checkButterflyViolations(activeOracles, sviSnapshots) {
  const violations = [];
  const ks = generateKGrid(60); // finer grid for butterfly
  const dk = ks[1] - ks[0];

  for (let i = 0; i < activeOracles.length; i++) {
    const svi = sviSnapshots[i];
    const oracle = activeOracles[i];
    if (!svi) continue;

    const T = calculateTimeToExpiry(oracle.expiry);
    if (T <= 0) continue;

    let hasViolation = false;

    for (let j = 1; j < ks.length - 1; j++) {
      const k = ks[j];
      const w = calculateTotalVariance(k, svi);
      const wPlus = calculateTotalVariance(k + dk, svi);
      const wMinus = calculateTotalVariance(k - dk, svi);

      // Second derivative of w
      const d2w = (wPlus - 2 * w + wMinus) / (dk * dk);
      // First derivative of w
      const dw = (wPlus - wMinus) / (2 * dk);

      if (w <= 0) continue;

      // Dupire density condition
      const g = (1 - (k * dw) / (2 * w)) ** 2 - (dw ** 2) / 4 * (1 / w + 0.25) + d2w / 2;

      if (g < 0) {
        hasViolation = true;
        break;
      }
    }

    if (hasViolation) {
      violations.push({ expiry: oracle.expiry });
    }
  }

  return violations;
}

/**
 * Regime Detection
 * Based on ATM IV level and term structure slope.
 *
 * ATM IV = IV at k=0 for nearest expiry
 * Slope  = IV difference between shortest and longest expiry at k=0
 *
 * Regimes:
 *   normal      — ATM IV < 80%, flat/upward slope
 *   elevated    — ATM IV 80–150%, any slope
 *   extreme     — ATM IV > 150%
 *   inverted    — downward sloping term structure (front > back)
 */
export function detectRegime(activeOracles, sviSnapshots) {
  if (!activeOracles.length || !sviSnapshots.length) return null;

  const frontSvi = sviSnapshots[0];
  const backSvi = sviSnapshots[sviSnapshots.length - 1];
  const frontOracle = activeOracles[0];
  const backOracle = activeOracles[activeOracles.length - 1];

  if (!frontSvi || !backSvi) return null;

  const frontT = calculateTimeToExpiry(frontOracle.expiry);
  const backT = calculateTimeToExpiry(backOracle.expiry);

  if (frontT <= 0 || backT <= 0) return null;

  const frontATMIV = calculateImpliedVolatility(0, frontT, frontSvi) * 100;
  const backATMIV = calculateImpliedVolatility(0, backT, backSvi) * 100;

  const slope = backATMIV - frontATMIV; // positive = normal, negative = inverted

  let regime;
  if (frontATMIV > 150) {
    regime = 'extreme';
  } else if (slope < -10) {
    regime = 'inverted';
  } else if (frontATMIV > 80) {
    regime = 'elevated';
  } else {
    regime = 'normal';
  }

  return {
    regime,
    frontATMIV: frontATMIV.toFixed(1),
    backATMIV: backATMIV.toFixed(1),
    slope: slope.toFixed(1),
  };
}