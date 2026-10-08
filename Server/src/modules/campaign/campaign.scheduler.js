import Campaign from './campaign.model.js';
import { CAMPAIGN_STATUS } from './campaign.constants.js';

/**
 * Campaign scheduler.
 *
 * SCOPE: this is pure lifecycle management — it promotes campaigns whose
 * scheduled time has arrived from SCHEDULED → RUNNING. It does NOT send any
 * messages. The Messaging module is the consumer that polls for RUNNING
 * campaigns, expands their groups into contacts, sends the WhatsApp template
 * messages and writes back the delivery counters + completedAt.
 *
 * Wire-up is intentionally left to the host (cron, a worker, or a setInterval
 * in server.js) so this module stays free of process/lifecycle assumptions:
 *
 *   import { startCampaignScheduler } from './src/modules/campaigns/campaign.scheduler.js';
 *   startCampaignScheduler();
 */

/**
 * Find every SCHEDULED campaign whose scheduledAt is now in the past and flip
 * it to RUNNING, stamping launchedAt. This sweep is cross-tenant by design (it
 * is system maintenance, not a user request) but only ever reads/writes the
 * status/launchedAt fields — it cannot leak campaign content between tenants.
 *
 * Uses a single bulk updateMany for efficiency and to avoid double-promotion
 * under concurrent runs: the { status: SCHEDULED } guard in the filter means a
 * campaign already promoted by a previous tick is skipped.
 *
 * Returns the number of campaigns promoted.
 */
export const promoteDueCampaigns = async (now = new Date()) => {
  const result = await Campaign.updateMany(
    {
      status: CAMPAIGN_STATUS.SCHEDULED,
      scheduledAt: { $ne: null, $lte: now },
    },
    {
      $set: { status: CAMPAIGN_STATUS.RUNNING, launchedAt: now },
    }
  );

  return result.modifiedCount || 0;
};

// Default interval between sweeps (ms). Overridable via env.
const DEFAULT_INTERVAL_MS = Number(process.env.CAMPAIGN_SCHEDULER_INTERVAL_MS) || 60_000;

let timer = null;

/**
 * Start the periodic scheduler. Safe to call once at boot. The timer is
 * unref()'d so it never keeps the process alive on its own.
 */
export const startCampaignScheduler = (intervalMs = DEFAULT_INTERVAL_MS) => {
  if (timer) return timer;

  timer = setInterval(async () => {
    try {
      const promoted = await promoteDueCampaigns();
      if (promoted > 0) {
        // eslint-disable-next-line no-console
        console.log(`[campaign.scheduler] promoted ${promoted} campaign(s) to RUNNING`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[campaign.scheduler] sweep failed:', err.message);
    }
  }, intervalMs);

  if (typeof timer.unref === 'function') timer.unref();
  return timer;
};

/** Stop the periodic scheduler (useful in tests / graceful shutdown). */
export const stopCampaignScheduler = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};
