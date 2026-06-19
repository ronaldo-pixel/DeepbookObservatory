/**
 * Keeper Service — DeepBook Observatory
 *
 * Polls for settled oracles, finds unredeemed positions,
 * calls redeem_permissionless on-chain, logs each tx.
 *
 * Entry point: predict::redeem_permissionless<Quote>
 * Inputs:      Predict, PredictManager, OracleSVI, MarketKey, Clock
 */

const { SuiClient, getFullnodeUrl } = require('@mysten/sui/client');
const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519');
const { Transaction } = require('@mysten/sui/transactions');
const axios = require('axios');
const { initDb, saveKeeperLog, isPositionRedeemed, getKeeperLogs } = require('./db');
require('dotenv').config();

// ── Config ──────────────────────────────────────────────
const PREDICT_SERVER  = process.env.PREDICT_SERVER  || 'https://predict-server.testnet.mystenlabs.com';
const PREDICT_ID      = process.env.PREDICT_ID      || '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a';
const PREDICT_PACKAGE = process.env.PREDICT_PACKAGE || '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138';
// Full coin type including package prefix
const QUOTE_ASSET     = process.env.QUOTE_ASSET     || '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC';

// Sui clock object (always this address on all networks)
const SUI_CLOCK = '0x6';

const POLL_INTERVAL_MS = 60_000; // 60s between keeper cycles

// ── Sui client + signer ─────────────────────────────────
const client = new SuiClient({ url: getFullnodeUrl('testnet') });

let keypair;
try {
  keypair = Ed25519Keypair.fromSecretKey(process.env.KEEPER_PRIVATE_KEY);
} catch (err) {
  console.error('❌ Invalid KEEPER_PRIVATE_KEY in .env:', err.message);
  process.exit(1);
}

const keeperAddress = keypair.toSuiAddress();
console.log(`Keeper address: ${keeperAddress}`);

// ── Helpers ─────────────────────────────────────────────

/**
 * Fetch all settled oracle IDs from the Predict server.
 */
async function getSettledOracles() {
  const res = await axios.get(`${PREDICT_SERVER}/predicts/${PREDICT_ID}/oracles`);
  return (res.data || []).filter(o => o.settled_at != null);
}

/**
 * Fetch positions that were minted but not yet permissionlessly redeemed,
 * for a given settled oracle. Uses /positions/minted endpoint filtered by oracle.
 */
async function getUnredeemedPositions(oracleId) {
  const [mintedRes, redeemedRes] = await Promise.all([
    axios.get(`${PREDICT_SERVER}/positions/minted`, { params: { oracle_id: oracleId } }),
    axios.get(`${PREDICT_SERVER}/positions/redeemed`, { params: { oracle_id: oracleId } }),
  ]);

  const minted   = mintedRes.data   || [];
  const redeemed = redeemedRes.data || [];

  // Build a set of already-redeemed (manager_id, market_key) pairs
  const redeemedSet = new Set(redeemed.map(r => `${r.manager_id}:${r.market_key}`));

  // Return minted positions not yet redeemed
  return minted.filter(p => !redeemedSet.has(`${p.manager_id}:${p.market_key}`));
}


/**
 * Build and execute a redeem_permissionless PTB for one position.
 *
 * predict::redeem_permissionless<Quote>(
 *   predict:    &mut Predict,
 *   manager:    &mut PredictManager,
 *   oracle:     &OracleSVI,
 *   market_key: &MarketKey,
 *   clock:      &Clock,
 * )
 */
async function redeemPosition(position, oracleId) {
  const tx = new Transaction();

  // The market_key is a Move struct — we pass it as a pure BCS-encoded argument.
  // The server returns market_key fields: oracle_id, expiry, strike, is_up
  const mk = position.market_key_parsed || {};

  tx.moveCall({
    target: `${PREDICT_PACKAGE}::predict::redeem_permissionless`,
    typeArguments: [QUOTE_ASSET],
    arguments: [
      tx.object(PREDICT_ID),              // &mut Predict
      tx.object(position.manager_id),     // &mut PredictManager
      tx.object(oracleId),                // &OracleSVI
      tx.object(position.market_key_id),  // &MarketKey (on-chain object)
      tx.object(SUI_CLOCK),               // &Clock
    ],
  });

  tx.setSender(keeperAddress);

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showEffects: true, showEvents: true },
  });

  return result;
}

// ── Main keeper loop ─────────────────────────────────────

async function runKeeperCycle() {
  console.log(`\n[${new Date().toISOString()}] Running keeper cycle...`);

  let settledOracles;
  try {
    settledOracles = await getSettledOracles();
  } catch (err) {
    console.error('Failed to fetch settled oracles:', err.message);
    return;
  }

  if (settledOracles.length === 0) {
    console.log('No settled oracles found.');
    return;
  }

  console.log(`Found ${settledOracles.length} settled oracle(s).`);

  for (const oracle of settledOracles) {
    const oracleId = oracle.oracle_id;
    console.log(`\nProcessing oracle: ${oracleId}`);

    let positions;
    try {
      positions = await getUnredeemedPositions(oracleId);
    } catch (err) {
      console.error(`  Failed to fetch positions for ${oracleId}:`, err.message);
      continue;
    }

    if (positions.length === 0) {
      console.log('  No unredeemed positions.');
      continue;
    }

    console.log(`  ${positions.length} unredeemed position(s) found.`);

    for (const position of positions) {
      // Use manager_id + market_key as a unique position identifier
      const positionId = `${position.manager_id}:${position.market_key}`;

      // Skip if already logged in our DB (idempotency guard)
      const alreadyDone = await isPositionRedeemed(positionId);
      if (alreadyDone) {
        console.log(`  Skipping ${positionId} — already redeemed.`);
        continue;
      }

      console.log(`  Redeeming position: ${positionId}`);

      try {
        const result = await redeemPosition(position, oracleId);
        const txDigest = result.digest;
        const status   = result.effects?.status?.status;

        if (status === 'success') {
          console.log(`  ✓ Redeemed. tx: ${txDigest}`);
          await saveKeeperLog(positionId, position.owner_address || '', 0, txDigest);
        } else {
          const err = result.effects?.status?.error;
          console.error(`  ✗ TX failed: ${err}`);
        }
      } catch (err) {
        console.error(`  ✗ Error redeeming ${positionId}:`, err.message);
      }

      // Small delay between transactions to avoid rate limiting
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`\nKeeper cycle complete.`);
}

// ── Entry point ──────────────────────────────────────────

async function main() {
  console.log('Starting DeepBook Observatory Keeper Service...');

  try {
    await initDb();
    console.log('✓ DB connected');
  } catch (err) {
    console.error('❌ DB init failed:', err.message);
    process.exit(1);
  }

  // Run immediately, then on interval
  await runKeeperCycle();
  setInterval(runKeeperCycle, POLL_INTERVAL_MS);
  console.log(`Keeper polling every ${POLL_INTERVAL_MS / 1000}s`);
}

main().catch(err => {
  console.error('Fatal keeper error:', err);
  process.exit(1);
});
