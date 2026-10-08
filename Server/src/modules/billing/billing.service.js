import billingRepository from './billing.repository.js';
import subscriptionRepository from './subscriptions/subscription.repository.js';
import planRepository from './plans/plan.repository.js';
import {
  SUBSCRIPTION_STATUS,
  UNLIMITED,
  USAGE_LIMIT_FIELD,
  FREE_PLAN_FALLBACK,
} from './billing.constants.js';

/**
 * Billing service — the access-resolution brain.
 *
 * Two responsibilities the rest of the platform leans on:
 *
 *   1. resolveEffectivePlan() — the single answer to "what can this tenant do
 *      right now?". It returns the tenant's ACTIVE, non-expired subscription's
 *      plan, or falls back to the Free plan (seeded, or the constant safety net)
 *      when there is no paid subscription. Both the usage middleware and the
 *      summary endpoint build on this, so platform access has exactly one
 *      source of truth.
 *
 *   2. getSummary() — the dashboard payload pairing that effective plan with the
 *      tenant's current usage.
 *
 * Reaches the database only through repositories.
 */
class BillingService {
  /** True when an ACTIVE subscription has a past expiresAt. */
  #isExpired(subscription) {
    return Boolean(
      subscription?.expiresAt &&
        new Date(subscription.expiresAt).getTime() <= Date.now()
    );
  }

  /** The Free plan (seeded), or the hard-coded fallback if it isn't seeded. */
  async #freePlan() {
    const free = await planRepository.findFree();
    return free || { ...FREE_PLAN_FALLBACK, _id: null };
  }

  /**
   * Resolve the tenant's effective plan and the subscription backing it.
   *
   * @returns {Promise<{plan:object, subscription:object|null, isFree:boolean}>}
   *   `subscription` is null when the tenant is on the implicit Free tier.
   */
  async resolveEffectivePlan(userId) {
    const subscription = await subscriptionRepository.findActiveLean(userId);

    if (subscription && !this.#isExpired(subscription)) {
      const plan = await planRepository.findById(subscription.planId);
      if (plan) {
        return { plan, subscription, isFree: plan.priceMonthly <= 0 };
      }
    }

    // No active paid subscription (or its plan vanished) → Free tier.
    const free = await this.#freePlan();
    return { plan: free, subscription: null, isFree: true };
  }

  /**
   * Evaluate a single usage limit for the tenant against its effective plan.
   * Shared by the usage middleware.
   *
   * @param {string} userId
   * @param {string} resource A USAGE_RESOURCE value.
   * @param {object} [effective] An already-resolved effective plan (from a prior
   *   checkSubscription) to avoid re-resolving; resolved here when omitted.
   * @returns {Promise<{allowed:boolean, used:number, limit:number, plan:object, unlimited:boolean}>}
   */
  async evaluateUsage(userId, resource, effective = null) {
    const { plan } = effective || (await this.resolveEffectivePlan(userId));
    const limit = plan[USAGE_LIMIT_FIELD[resource]];
    const unlimited = limit === UNLIMITED;

    if (unlimited) {
      return { allowed: true, used: 0, limit, plan, unlimited: true };
    }

    const used = await billingRepository.countForResource(userId, resource);
    return { allowed: used < limit, used, limit, plan, unlimited: false };
  }

  /**
   * The billing dashboard summary: effective plan, status, per-metric usage vs
   * limit, and the current period's expiry. Unlimited metrics report their
   * limit as UNLIMITED (-1), matching the plan representation.
   */
  async getSummary(userId) {
    const [{ plan, subscription }, usage] = await Promise.all([
      this.resolveEffectivePlan(userId),
      billingRepository.usageSnapshot(userId),
    ]);

    return {
      plan: plan.name,
      status: subscription ? subscription.status : SUBSCRIPTION_STATUS.ACTIVE,
      billingCycle: subscription ? subscription.billingCycle : null,
      autoRenew: subscription ? subscription.autoRenew : false,

      contactsUsed: usage.contactsUsed,
      contactsLimit: plan.maxContacts,

      messagesUsed: usage.messagesUsed,
      messagesLimit: plan.maxMessagesPerMonth,

      campaignsUsed: usage.campaignsUsed,
      campaignsLimit: plan.maxCampaignsPerMonth,

      startsAt: subscription ? subscription.startsAt : null,
      expiresAt: subscription ? subscription.expiresAt : null,
      cancelledAt: subscription ? subscription.cancelledAt : null,
    };
  }
}

export default new BillingService();
