/**
 * Shared constants for the Subscription & Billing module.
 *
 * Billing is the platform's single source of truth for access. It ties together
 * three collections — Plan (what a tenant can buy), Subscription (what a tenant
 * currently holds) and Payment (the Razorpay-backed money trail) — and exposes
 * the usage gates (`checkSubscription`, `checkUsageLimit`) the rest of the app
 * relies on to enforce plan limits.
 *
 * Every enum, transition set, limit and user-facing message lives here so the
 * three sub-modules, the middleware and the Razorpay client all speak one
 * vocabulary instead of re-deriving it. Secrets are read through lazy getters
 * (mirroring the Webhook module) rather than captured at import time, so the
 * module imports cleanly in environments where Razorpay isn't configured.
 */

// ── Subscription status ───────────────────────────────────────────────────────
export const SUBSCRIPTION_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  PENDING: 'PENDING',
});

export const SUBSCRIPTION_STATUS_VALUES = Object.values(SUBSCRIPTION_STATUS);

// ── Billing cycle ─────────────────────────────────────────────────────────────
export const BILLING_CYCLE = Object.freeze({
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
});

export const BILLING_CYCLE_VALUES = Object.values(BILLING_CYCLE);

// ── Payment status ────────────────────────────────────────────────────────────
export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
});

export const PAYMENT_STATUS_VALUES = Object.values(PAYMENT_STATUS);

// ── Usage resources guarded by checkUsageLimit() ──────────────────────────────
// The key the usage middleware is parameterised with, mapped to the plan field
// that caps it. Keeping the mapping here means the middleware never hard-codes a
// field name and a new metered resource is a one-line addition.
export const USAGE_RESOURCE = Object.freeze({
  CONTACT: 'CONTACT',
  CAMPAIGN: 'CAMPAIGN',
  MESSAGE: 'MESSAGE',
});

export const USAGE_RESOURCE_VALUES = Object.values(USAGE_RESOURCE);

// Maps a metered resource to the Plan limit field that caps it.
export const USAGE_LIMIT_FIELD = Object.freeze({
  [USAGE_RESOURCE.CONTACT]: 'maxContacts',
  [USAGE_RESOURCE.CAMPAIGN]: 'maxCampaignsPerMonth',
  [USAGE_RESOURCE.MESSAGE]: 'maxMessagesPerMonth',
});

// The sentinel a plan uses to mean "no cap" (Enterprise). Any limit equal to
// this value disables the corresponding usage gate.
export const UNLIMITED = -1;

// ── Razorpay ──────────────────────────────────────────────────────────────────
export const RAZORPAY = Object.freeze({
  ORDERS_URL: 'https://api.razorpay.com/v1/orders',
  // Razorpay works in the smallest currency sub-unit (paise for INR). Plan
  // prices are stored in whole rupees, so amounts are multiplied by this.
  SUBUNIT_MULTIPLIER: 100,
  DEFAULT_CURRENCY: 'INR',
  SIGNATURE_HEADER: 'x-razorpay-signature',
});

// Razorpay webhook event types this module understands.
export const RAZORPAY_EVENT = Object.freeze({
  PAYMENT_CAPTURED: 'payment.captured',
  PAYMENT_FAILED: 'payment.failed',
  ORDER_PAID: 'order.paid',
});

// Lazy secret getters — evaluated per call so a missing key only matters when a
// paid flow is actually exercised, never at import time.
export const getRazorpayKeyId = () => process.env.RAZORPAY_KEY_ID || '';
export const getRazorpayKeySecret = () => process.env.RAZORPAY_KEY_SECRET || '';
export const getRazorpayWebhookSecret = () =>
  process.env.RAZORPAY_WEBHOOK_SECRET || '';

// ── Pagination defaults ───────────────────────────────────────────────────────
export const BILLING_PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
});

export const BILLING_TIMEOUTS = Object.freeze({
  PENDING_SUBSCRIPTION_MS: 1 * 60 * 1000, // 15 minutes
});

// ── Field limits ──────────────────────────────────────────────────────────────
export const PLAN_LIMITS = Object.freeze({
  NAME_MAX: 60,
  DESCRIPTION_MAX: 500,
  FEATURE_MAX: 80,
  MAX_FEATURES: 50,
});

// ── Well-known plan names ─────────────────────────────────────────────────────
// The Free plan is the implicit fallback for any tenant without a paid,
// non-expired subscription, so its name is referenced by code (the effective-
// plan resolver) and must stay in sync with the seed below.
export const PLAN_NAMES = Object.freeze({
  FREE: 'Free',
  STARTER: 'Starter',
  GROWTH: 'Growth',
  ENTERPRISE: 'Enterprise',
});

/**
 * Hard-coded Free-tier limits used as a safety net ONLY when the Free plan has
 * not been seeded into the database. The seeded Free plan (see DEFAULT_PLANS)
 * is always preferred; this guarantees the usage gates still behave sensibly on
 * a fresh install before seeding has run.
 */
export const FREE_PLAN_FALLBACK = Object.freeze({
  name: PLAN_NAMES.FREE,
  priceMonthly: 0,
  priceYearly: 0,
  maxContacts: 100,
  maxCampaignsPerMonth: 2,
  maxMessagesPerMonth: 100,
  features: [],
});

/**
 * Canonical default plan catalogue. Consumed by the seed script
 * (plans/plan.seed.js). Prices are in whole rupees; unlimited is UNLIMITED (-1).
 */
export const DEFAULT_PLANS = Object.freeze([
  {
    name: PLAN_NAMES.FREE,
    description: 'Get started for free',
    priceMonthly: 0,
    priceYearly: 0,
    maxContacts: 100,
    maxCampaignsPerMonth: 2,
    maxMessagesPerMonth: 100,
    features: ['100 contacts', '2 campaigns / month', '100 messages / month'],
    isActive: true,
  },
  {
    name: PLAN_NAMES.STARTER,
    description: 'For small teams getting going',
    priceMonthly: 499,
    priceYearly: 4990,
    maxContacts: 5000,
    maxCampaignsPerMonth: 50,
    maxMessagesPerMonth: 10000,
    features: [
      '5,000 contacts',
      '50 campaigns / month',
      '10,000 messages / month',
    ],
    isActive: true,
  },
  {
    name: PLAN_NAMES.GROWTH,
    description: 'For scaling businesses',
    priceMonthly: 1499,
    priceYearly: 14990,
    maxContacts: 25000,
    maxCampaignsPerMonth: 500,
    maxMessagesPerMonth: 100000,
    features: [
      '25,000 contacts',
      '500 campaigns / month',
      '100,000 messages / month',
    ],
    isActive: true,
  },
  {
    name: PLAN_NAMES.ENTERPRISE,
    description: 'Unlimited everything',
    priceMonthly: 4999,
    priceYearly: 49990,
    maxContacts: UNLIMITED,
    maxCampaignsPerMonth: UNLIMITED,
    maxMessagesPerMonth: UNLIMITED,
    features: [
      'Unlimited contacts',
      'Unlimited campaigns',
      'Unlimited messages',
    ],
    isActive: true,
  },
]);

// ── User-facing messages ──────────────────────────────────────────────────────
export const BILLING_MESSAGES = Object.freeze({
  // Plans
  PLAN_LIST_FETCHED: 'Plans fetched successfully',
  PLAN_FETCHED: 'Plan fetched successfully',
  PLAN_CREATED: 'Plan created successfully',
  PLAN_UPDATED: 'Plan updated successfully',
  PLAN_DELETED: 'Plan deleted successfully',
  PLAN_NOT_FOUND: 'Plan not found',
  PLAN_INACTIVE: 'This plan is not available for subscription',
  PLAN_DUPLICATE_NAME: 'A plan with this name already exists',

  // Subscriptions
  SUBSCRIPTION_FETCHED: 'Subscription fetched successfully',
  SUBSCRIPTION_CREATED: 'Subscription created successfully',
  SUBSCRIPTION_ACTIVATED: 'Subscription activated successfully',
  SUBSCRIPTION_UPGRADED: 'Subscription upgrade initiated successfully',
  SUBSCRIPTION_CANCELLED:
    'Subscription cancelled — access remains until the end of the current period',
  SUBSCRIPTION_NOT_FOUND: 'No active subscription found',
  SUBSCRIPTION_ALREADY_ON_PLAN: 'You are already subscribed to this plan',
  SUBSCRIPTION_PENDING_EXISTS:
    'A payment for a previous request is still pending — complete or cancel it first',
  SUBSCRIPTION_NOT_CANCELLABLE: 'Only an active subscription can be cancelled',

  // Payments
  PAYMENT_LIST_FETCHED: 'Payments fetched successfully',
  PAYMENT_FETCHED: 'Payment fetched successfully',
  PAYMENT_NOT_FOUND: 'Payment not found',
  PAYMENT_VERIFIED: 'Payment verified successfully',
  PAYMENT_ALREADY_PROCESSED: 'This payment has already been processed',
  PAYMENT_SIGNATURE_INVALID: 'Payment signature verification failed',
  WEBHOOK_PROCESSED: 'Webhook processed',
  WEBHOOK_SIGNATURE_INVALID: 'Invalid webhook signature',

  // Billing summary
  SUMMARY_FETCHED: 'Billing summary fetched successfully',

  // Access gates
  NO_ACTIVE_SUBSCRIPTION:
    'No active subscription — subscribe to a plan to access this feature',
  SUBSCRIPTION_EXPIRED:
    'Your subscription has expired — renew to continue using this feature',
  CONTACT_LIMIT_REACHED:
    'Contact limit reached for your current plan — upgrade to add more contacts',
  CAMPAIGN_LIMIT_REACHED:
    'Monthly campaign limit reached for your current plan — upgrade to create more campaigns',
  MESSAGE_LIMIT_REACHED:
    'Monthly message limit reached for your current plan — upgrade to send more messages',

  // Razorpay / infra
  RAZORPAY_NOT_CONFIGURED:
    'Payment gateway is not configured — contact the platform administrator',
  RAZORPAY_ORDER_FAILED: 'Failed to create payment order — please try again',
});

// Maps a metered resource to its "limit reached" message.
export const USAGE_LIMIT_MESSAGE = Object.freeze({
  [USAGE_RESOURCE.CONTACT]: BILLING_MESSAGES.CONTACT_LIMIT_REACHED,
  [USAGE_RESOURCE.CAMPAIGN]: BILLING_MESSAGES.CAMPAIGN_LIMIT_REACHED,
  [USAGE_RESOURCE.MESSAGE]: BILLING_MESSAGES.MESSAGE_LIMIT_REACHED,
});
