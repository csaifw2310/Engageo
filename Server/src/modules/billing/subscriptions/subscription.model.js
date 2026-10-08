import mongoose from 'mongoose';

import {
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_STATUS_VALUES,
  BILLING_CYCLE,
  BILLING_CYCLE_VALUES,
} from '../billing.constants.js';

/**
 * Subscription
 *
 * A tenant's relationship to a Plan over time. A tenant has at most ONE ACTIVE
 * subscription at any moment (enforced by a partial unique index) plus, while a
 * paid change is mid-flight, at most one PENDING subscription awaiting payment.
 * Historic subscriptions remain as EXPIRED / CANCELLED rows.
 *
 * Tenant isolation is enforced two ways:
 *   1. Every repository query filters on `userId`.
 *   2. The partial unique index { userId } where status=ACTIVE guarantees the
 *      "one active subscription per tenant" rule atomically at the DB layer.
 *
 * The Free tier is NOT represented by a stored row — a tenant with no ACTIVE,
 * non-expired subscription is treated as Free by the effective-plan resolver in
 * billing.service. Only paid (or explicitly chosen) subscriptions are persisted.
 */
const subscriptionSchema = new mongoose.Schema(
  {
    // Tenant owner.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // The plan this subscription grants. Denormalised reference — the plan
    // document may later change price/limits; access decisions always re-read
    // the current Plan via this id.
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
    },

    status: {
      type: String,
      enum: SUBSCRIPTION_STATUS_VALUES,
      default: SUBSCRIPTION_STATUS.PENDING,
    },

    // Active window. Set when the subscription is activated (paid). A null
    // expiresAt means "no expiry" (e.g. a manually granted plan).
    startsAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },

    billingCycle: {
      type: String,
      enum: BILLING_CYCLE_VALUES,
      default: BILLING_CYCLE.MONTHLY,
    },

    // When false (after a cancel), the subscription will not renew and simply
    // lapses to EXPIRED at expiresAt. Access is retained until then.
    autoRenew: {
      type: Boolean,
      default: true,
    },

    // Stamped when the tenant cancels (autoRenew → false). Distinct from
    // expiry: a cancelled subscription stays ACTIVE until expiresAt.
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// One ACTIVE subscription per tenant — enforced atomically.
subscriptionSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: SUBSCRIPTION_STATUS.ACTIVE },
  }
);

// Tenant-scoped lookups: current subscription by status, history listing, and
// the (rare) expiry sweep.
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ userId: 1, createdAt: -1 });
subscriptionSchema.index({ status: 1, expiresAt: 1 });

export default mongoose.model('Subscription', subscriptionSchema);
