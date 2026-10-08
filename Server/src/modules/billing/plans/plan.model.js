import mongoose from 'mongoose';

import {
  PLAN_LIMITS,
  UNLIMITED,
  BILLING_CYCLE,
} from '../billing.constants.js';

/**
 * Plan
 *
 * A purchasable subscription tier. Unlike most documents in Engageo, a Plan is
 * platform-wide (NOT tenant-scoped) — every tenant chooses from the same
 * catalogue, and only an admin may create or mutate plans. Tenant isolation
 * therefore lives entirely in the Subscription/Payment collections that
 * reference a plan, not here.
 *
 * Limits use the project-wide convention that UNLIMITED (-1) means "no cap"
 * (the Enterprise tier). The billing usage gates treat any limit of -1 as
 * disabled.
 */
const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Plan name is required'],
      trim: true,
      maxlength: [
        PLAN_LIMITS.NAME_MAX,
        `Plan name cannot exceed ${PLAN_LIMITS.NAME_MAX} characters`,
      ],
    },

    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [
        PLAN_LIMITS.DESCRIPTION_MAX,
        `Description cannot exceed ${PLAN_LIMITS.DESCRIPTION_MAX} characters`,
      ],
    },

    // Prices in whole rupees. Razorpay amounts (paise) are derived at order
    // time by the subscription service.
    priceMonthly: {
      type: Number,
      required: [true, 'Monthly price is required'],
      min: [0, 'Monthly price cannot be negative'],
    },
    priceYearly: {
      type: Number,
      default: 0,
      min: [0, 'Yearly price cannot be negative'],
    },

    // Usage caps. UNLIMITED (-1) disables the corresponding gate; any other
    // value must be >= -1 (a plain non-negative cap, or the -1 sentinel).
    maxContacts: {
      type: Number,
      required: true,
      min: [UNLIMITED, 'maxContacts must be -1 (unlimited) or a positive number'],
    },
    maxCampaignsPerMonth: {
      type: Number,
      required: true,
      min: [
        UNLIMITED,
        'maxCampaignsPerMonth must be -1 (unlimited) or a positive number',
      ],
    },
    maxMessagesPerMonth: {
      type: Number,
      required: true,
      min: [
        UNLIMITED,
        'maxMessagesPerMonth must be -1 (unlimited) or a positive number',
      ],
    },

    features: {
      type: [String],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Plan names are globally unique (case-insensitive) — there is exactly one
// "Free", "Starter", etc. The collation makes "free" and "Free" collide.
planSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

// Public listing path filters on active plans and orders by price.
planSchema.index({ isActive: 1, priceMonthly: 1 });

/**
 * Resolve the price for a billing cycle. Falls back to the monthly price when a
 * yearly price has not been configured, so a misconfigured plan never produces
 * a zero-rupee yearly order by accident.
 */
planSchema.methods.priceFor = function priceFor(billingCycle) {
  if (billingCycle === BILLING_CYCLE.YEARLY) {
    return this.priceYearly > 0 ? this.priceYearly : this.priceMonthly * 12;
  }
  return this.priceMonthly;
};

export default mongoose.model('Plan', planSchema);
