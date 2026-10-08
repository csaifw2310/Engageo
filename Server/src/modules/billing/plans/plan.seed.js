// only for development — fixes DNS SRV lookup failures on networks that block them
import dns from 'dns';
dns.setServers(['1.1.1.1', '8.8.8.8']);

import mongoose from 'mongoose';

import Plan from './plan.model.js';
import { DEFAULT_PLANS } from '../billing.constants.js';

/**
 * Seed the default plan catalogue (Free / Starter / Growth / Enterprise).
 *
 * Idempotent: each plan is upserted by its unique name, so re-running refreshes
 * prices/limits without creating duplicates and without disturbing live
 * subscriptions (which reference plans by id, and ids are preserved across
 * upserts).
 *
 * Two ways to use it:
 *   1. Programmatically, after the DB connection is open (e.g. a one-off admin
 *      task or a bootstrap step):
 *        import seedPlans from './modules/billing/plans/plan.seed.js';
 *        await seedPlans();
 *
 *   2. Directly from the CLI (it connects, seeds, and exits):
 *        node src/modules/billing/plans/plan.seed.js
 */
export async function seedPlans() {
  const results = [];
  for (const plan of DEFAULT_PLANS) {
    const doc = await Plan.findOneAndUpdate(
      { name: plan.name },
      { $set: plan },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        collation: { locale: 'en', strength: 2 },
      }
    );
    results.push(doc);
  }
  return results;
}

// ── CLI entrypoint ────────────────────────────────────────────────────────────
// Runs only when this file is executed directly, not when imported.
const isDirectRun =
  process.argv[1] && process.argv[1].endsWith('plan.seed.js');

if (isDirectRun) {
  const run = async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('❌ MONGODB_URI is not set — cannot seed plans.');
      process.exit(1);
    }
    try {
      await mongoose.connect(uri);
      const plans = await seedPlans();
      console.log(`✅ Seeded ${plans.length} plans:`);
      for (const p of plans) {
        console.log(`   • ${p.name} (₹${p.priceMonthly}/mo)`);
      }
    } catch (err) {
      console.error(`❌ Plan seed failed: ${err.message}`);
      process.exitCode = 1;
    } finally {
      await mongoose.connection.close();
    }
  };
  run();
}

export default seedPlans;