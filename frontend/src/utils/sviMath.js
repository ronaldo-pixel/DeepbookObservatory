import axios from "axios";

/**
 * SVI (Stochastic Volatility Inspired) Math Utilities
 */

const PRICE_SCALE = 1e9;
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


export async function getLiveSurface(oracles, numPoints = 30) {
  const now = Date.now();
  const activeOracles = getActiveOraclesAtTime(oracles, 0);

  if (activeOracles.length === 0) return null;

  const histories = await Promise.all(
    activeOracles.map(async (oracle) => {
      const [pricesRes, sviRes] = await Promise.all([
        axios.get(`${PREDICT_SERVER}/oracles/${oracle.oracle_id}/prices/latest`),
        axios.get(`${PREDICT_SERVER}/oracles/${oracle.oracle_id}/svi/latest`),
      ]);

      return {
        oracle_id: oracle.oracle_id,
        price: pricesRes.data,
        svi: sviRes.data,
      };
    })
  );

  const ks = generateKGrid(numPoints);
  const surfaceData = [];
  const expiryTimes = [];

  for (let i = 0; i < activeOracles.length; i++) {
    const oracle = activeOracles[i];
    const history = histories[i];

    const sviSnapshot = history.svi;
    if (!sviSnapshot) continue;

    const T = calculateTimeToExpiry(oracle.expiry, now);
    if (T <= 0) continue;

    expiryTimes.push(T * 365.25 * 24);
    surfaceData.push(
      ks.map((k) => calculateImpliedVolatility(k, T, sviSnapshot) * 100)
    );
  }

  if (surfaceData.length === 0) return null;

  return { ks, expiryTimes, surfaceData };
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