import subscriptionRepository from './subscription.repository.js';
import planRepository from '../plans/plan.repository.js';
import paymentRepository from '../payments/payment.repository.js';
import razorpay from '../razorpay/razorpay.client.js';
import ApiError from '../../../utils/ApiError.js';
import notificationEvents from '../../notifications/notification.events.js';
import {
  SUBSCRIPTION_STATUS,
  BILLING_CYCLE,
  PAYMENT_STATUS,
  RAZORPAY,
  BILLING_MESSAGES,
  getRazorpayKeyId,
  BILLING_TIMEOUTS,
} from '../billing.constants.js';

/**
 * Subscription lifecycle service.
 *
 * The heart of the billing module. Every method is tenant-scoped (takes the
 * authenticated `userId`) and reaches the database only through repositories —
 * never a model directly.
 *
 * Money flows always follow the same shape: a paid change creates a PENDING
 * subscription + a Razorpay order + a PENDING payment, and the subscription is
 * only ACTIVATED once that payment is confirmed (by the verify endpoint or the
 * webhook, both of which call `activateForPayment`). A zero-rupee change (the
 * Free tier) activates immediately with no Razorpay round-trip.
 *
 * "One ACTIVE subscription per tenant" is enforced by a partial unique index;
 * activation expires any prior ACTIVE row first so upgrades/downgrades never
 * leave two live subscriptions.
 */
class SubscriptionService {
  // ── Reads ───────────────────────────────────────────────────────────────────

  /**
   * The tenant's current ACTIVE subscription with its plan embedded, or null
   * when the tenant is on the implicit Free tier (no stored ACTIVE row). A
   * past-expiry ACTIVE row is treated as not current.
   */
  async getCurrentSubscription(userId) {
    const subscription = await subscriptionRepository.findActiveLean(userId);
    if (!subscription || this.#isExpired(subscription)) return null;

    const plan = await planRepository.findById(subscription.planId);
    return { ...subscription, plan: plan || null };
  }

  // ── Create ────────────────────────────────────────────────────────────────

  /**
   * Begin a subscription to `planId`.
   *
   * Free plan → activated immediately (no payment).
   * Paid plan → creates a PENDING subscription, opens a Razorpay order and a
   *             PENDING payment, and returns the order for the client to pay.
   *
   * @returns {Promise<{subscriptionId:string, status:string, paymentOrder:object|null}>}
   */
  async createSubscription(userId, { planId, billingCycle, autoRenew } = {}) {
    const plan = await this.#loadPurchasablePlan(planId);
    await this.#assertNoPendingChange(userId);

    const cycle = this.#normaliseCycle(billingCycle);
    const renew = autoRenew === undefined ? true : Boolean(autoRenew);
    const price = plan.priceFor(cycle);

    if (price <= 0) {
      const subscription = await this.#activateFreeImmediately(userId, plan._id, cycle, renew);
      return {
        subscriptionId: String(subscription._id),
        status: subscription.status,
        paymentOrder: null,
      };
    }

    return this.#beginPaidChange(userId, {
      plan,
      cycle,
      renew,
      price,
      changeType: 'create',
    });
  }

  // ── Upgrade / downgrade ─────────────────────────────────────────────────────

  /**
   * Move the tenant to a different plan. Behaves like create but rejects a
   * no-op (already on the target plan). Downgrade to a free plan applies
   * immediately; any paid target opens a fresh order whose successful payment
   * activates the new plan and expires the old one.
   */
  async upgradeSubscription(userId, { planId, billingCycle, autoRenew } = {}) {
    const plan = await this.#loadPurchasablePlan(planId);

    const current = await subscriptionRepository.findActiveLean(userId);
    if (
      current &&
      !this.#isExpired(current) &&
      String(current.planId) === String(plan._id)
    ) {
      throw new ApiError(409, BILLING_MESSAGES.SUBSCRIPTION_ALREADY_ON_PLAN);
    }

    await this.#assertNoPendingChange(userId);

    const cycle = this.#normaliseCycle(billingCycle);
    const renew = autoRenew === undefined ? true : Boolean(autoRenew);
    const price = plan.priceFor(cycle);

    if (price <= 0) {
      const subscription = await this.#activateFreeImmediately(userId, plan._id, cycle, renew);
      return {
        subscriptionId: String(subscription._id),
        status: subscription.status,
        paymentOrder: null,
      };
    }

    return this.#beginPaidChange(userId, {
      plan,
      cycle,
      renew,
      price,
      changeType: 'upgrade',
    });
  }

  // ── Cancel ──────────────────────────────────────────────────────────────────

  /**
   * Cancel the tenant's ACTIVE subscription: turn off auto-renew and stamp
   * cancelledAt. Status stays ACTIVE and access is retained until expiresAt —
   * the subscription simply lapses to EXPIRED at the end of the period.
   */
  async cancelSubscription(userId) {
    const subscription = await subscriptionRepository.findActive(userId);
    if (!subscription) {
      throw new ApiError(404, BILLING_MESSAGES.SUBSCRIPTION_NOT_CANCELLABLE);
    }

    const updated = await subscriptionRepository.updateById(subscription._id, {
      autoRenew: false,
      cancelledAt: new Date(),
    });

    notificationEvents.subscriptionCancelled(userId, updated);

    return updated;
  }

  async cancelPendingSubscription(userId, subscriptionId) {
  return subscriptionRepository.cancelPending(userId, subscriptionId);
}

  // ── Activation (called by the payment layer) ─────────────────────────────────

  /**
   * Activate the subscription funded by a now-successful payment. Idempotent:
   * if the subscription is already ACTIVE it is returned unchanged. Any prior
   * ACTIVE subscription for the tenant is expired first so the partial unique
   * index is never violated.
   *
   * Invoked by the payment service after it has atomically marked the payment
   * SUCCESS (so this can only run once per payment).
   *
   * @param {object} payment A payment document (or lean object).
   * @returns {Promise<object|null>} the activated subscription, or null when the
   *   referenced subscription no longer exists.
   */
  async activateForPayment(payment) {
    const subscription = await subscriptionRepository.findOwned(
      payment.userId,
      payment.subscriptionId
    );
    if (!subscription) return null;
    if (subscription.status === SUBSCRIPTION_STATUS.ACTIVE) return subscription;

    const startsAt = new Date();
    const expiresAt = this.#computeExpiry(startsAt, subscription.billingCycle);

    // Expire whatever the tenant currently holds, then promote this one.
      const activated = await subscriptionRepository.activateSubscriptionAtomically({
    userId: payment.userId,
    subscriptionId: subscription._id,
    startsAt,
    expiresAt,
  });

    const plan = await planRepository.findById(subscription.planId);
    notificationEvents.subscriptionActivated(payment.userId, activated || subscription, plan);

    return activated;
  }

  // ── Internal helpers ─────────────────────────────────────────────────────────

  /** Load a plan that exists and is open for subscription (404 / 400 otherwise). */
  async #loadPurchasablePlan(planId) {
    const plan = await planRepository.findDocById(planId);
    if (!plan) throw new ApiError(404, BILLING_MESSAGES.PLAN_NOT_FOUND);
    if (!plan.isActive) throw new ApiError(400, BILLING_MESSAGES.PLAN_INACTIVE);
    return plan;
  }

  /** Reject if a payment for a previous request is still pending. */
async #assertNoPendingChange(userId) {
  const pending = await subscriptionRepository.findPending(userId);

  if (!pending) return;

  const age = Date.now() - pending.createdAt.getTime();

  if (age < BILLING_TIMEOUTS.PENDING_SUBSCRIPTION_MS) {
    throw new ApiError(
      409,
      BILLING_MESSAGES.SUBSCRIPTION_PENDING_EXISTS
    );
  }

await subscriptionRepository.cancelPending(
  userId,
  pending._id
);

await paymentRepository.markFailedBySubscriptionIfPending(
  pending._id,
  {
    metadata: {
      reason: 'Payment session expired',
      expiredAt: new Date(),
    },
  }
);
}
  /** Coerce an optional billing cycle to a valid value (defaults to MONTHLY). */
  #normaliseCycle(billingCycle) {
    return billingCycle === BILLING_CYCLE.YEARLY
      ? BILLING_CYCLE.YEARLY
      : BILLING_CYCLE.MONTHLY;
  }

  /** True when an ACTIVE subscription's expiresAt has already passed. */
  #isExpired(subscription) {
    return Boolean(
      subscription.expiresAt && new Date(subscription.expiresAt).getTime() <= Date.now()
    );
  }

  /** startsAt + one billing period. */
  #computeExpiry(startsAt, billingCycle) {
    const expiry = new Date(startsAt);
    if (billingCycle === BILLING_CYCLE.YEARLY) {
      expiry.setFullYear(expiry.getFullYear() + 1);
    } else {
      expiry.setMonth(expiry.getMonth() + 1);
    }
    return expiry;
  }

  /**
   * Activate a zero-rupee plan straight away: expire any current ACTIVE row and
   * create a fresh ACTIVE subscription. Free subscriptions never expire
   * (expiresAt = null).
   */
  async #activateFreeImmediately(userId, planId, cycle, renew) {
    await subscriptionRepository.expireActiveForUser(userId);
    return subscriptionRepository.create({
      userId,
      planId,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      startsAt: new Date(),
      expiresAt: null,
      billingCycle: cycle,
      autoRenew: renew,
    });
  }

  /**
   * Shared paid-change flow: PENDING subscription → Razorpay order → PENDING
   * payment. If the order fails, the PENDING subscription is rolled back so the
   * tenant is never left with a dangling unpayable row.
   */
  async #beginPaidChange(userId, { plan, cycle, renew, price, changeType }) {
    const subscription = await subscriptionRepository.create({
      userId,
      planId: plan._id,
      status: SUBSCRIPTION_STATUS.PENDING,
      billingCycle: cycle,
      autoRenew: renew,
    });

    let order;
    try {
      order = await razorpay.createOrder({
        amount: Math.round(price * RAZORPAY.SUBUNIT_MULTIPLIER),
        currency: RAZORPAY.DEFAULT_CURRENCY,
        receipt: `sub_${subscription._id}`,
        notes: {
          userId: String(userId),
          planId: String(plan._id),
          planName: plan.name,
          billingCycle: cycle,
          changeType,
        },
      });
    } catch (err) {
      // Roll back the orphaned PENDING subscription before surfacing the error.
      await subscriptionRepository.updateById(subscription._id, {
        status: SUBSCRIPTION_STATUS.CANCELLED,
        cancelledAt: new Date(),
      });
      throw err;
    }

    try {
  await paymentRepository.create({
    userId,
    subscriptionId: subscription._id,
    amount: price,
    currency: RAZORPAY.DEFAULT_CURRENCY,
    status: PAYMENT_STATUS.PENDING,
    razorpayOrderId: order.id,
    metadata: {
      planId: String(plan._id),
      planName: plan.name,
      billingCycle: cycle,
      changeType,
    },
  });
} catch (err) {
  await subscriptionRepository.updateById(subscription._id, {
    status: SUBSCRIPTION_STATUS.CANCELLED,
    cancelledAt: new Date(),
  });

  throw err;
}

    return {
      subscriptionId: String(subscription._id),
      status: subscription.status,
      paymentOrder: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
        // Publishable key the frontend needs to open Razorpay Checkout.
        keyId: getRazorpayKeyId(),
      },
    };
  }
}

export default new SubscriptionService();
