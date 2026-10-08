import mongoose from 'mongoose';

import {
  PAYMENT_STATUS,
  PAYMENT_STATUS_VALUES,
  RAZORPAY,
} from '../billing.constants.js';

/**
 * Payment
 *
 * One Razorpay-backed payment attempt for a subscription. Created PENDING
 * alongside a Razorpay order, then advanced to SUCCESS (payment captured),
 * FAILED or REFUNDED. It is the immutable money trail behind every paid
 * subscription transition (create / upgrade / renew).
 *
 * Tenant isolation is enforced two ways:
 *   1. Every repository query filters on `userId`.
 *   2. razorpayOrderId is globally unique (sparse) so a webhook can resolve the
 *      owning payment without trusting any tenant-supplied id, and a duplicate
 *      callback can never create a second payment.
 *
 * Idempotency: status transitions out of PENDING are applied conditionally by
 * the repository, so an at-least-once webhook (Razorpay retries) can never
 * double-activate a subscription.
 */
const paymentSchema = new mongoose.Schema(
  {
    // Tenant owner.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // The subscription this payment funds.
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true,
    },

    // Amount in whole rupees (mirrors the plan price). The paise figure sent to
    // Razorpay is derived; only the human-facing amount is stored.
    amount: {
      type: Number,
      required: true,
      min: [0, 'amount cannot be negative'],
    },
    currency: {
      type: String,
      default: RAZORPAY.DEFAULT_CURRENCY,
      uppercase: true,
      trim: true,
    },

    status: {
      type: String,
      enum: PAYMENT_STATUS_VALUES,
      default: PAYMENT_STATUS.PENDING,
    },

    // Razorpay correlation ids. orderId is set at creation; paymentId is set on
    // a successful capture / verification.
    razorpayOrderId: {
      type: String,
      default: null,
      trim: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
      trim: true,
    },

    // Stamped when the payment is confirmed SUCCESS.
    paidAt: {
      type: Date,
      default: null,
    },

    // Free-form provider/context data (e.g. the planId and billingCycle being
    // purchased, the webhook event id). Never trusted for access decisions.
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Globally unique order id (sparse so PENDING rows without one don't collide on
// null). This is the webhook's lookup key and the guard against duplicate rows.
paymentSchema.index(
  { razorpayOrderId: 1 },
  { unique: true, sparse: true }
);

// Tenant-scoped history listing (newest first) and lookups.
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ subscriptionId: 1 });

export default mongoose.model('Payment', paymentSchema);
