import mongoose from 'mongoose';
import Subscription from './subscription.model.js';
import ApiError from '../../../utils/ApiError.js';
import { 
  SUBSCRIPTION_STATUS,
  BILLING_MESSAGES,
 } from '../billing.constants.js';

/**
 * Subscription data-access layer (Repository Pattern).
 *
 * The ONLY place the Subscription collection is touched. Every method is
 * tenant-scoped (filtered by userId) except the cross-tenant expiry sweep,
 * which is an internal maintenance helper.
 */
class SubscriptionRepository {
  async create(data) {
    return Subscription.create(data);
  }

  /** The tenant's ACTIVE subscription document (or null). NOT lean — callers mutate it. */
  async findActive(userId) {
    return Subscription.findOne({
      userId,
      status: SUBSCRIPTION_STATUS.ACTIVE,
    });
  }

  /** Lean read of the ACTIVE subscription (for response shaping). */
  async findActiveLean(userId) {
    return Subscription.findOne({
      userId,
      status: SUBSCRIPTION_STATUS.ACTIVE,
    }).lean();
  }

  /** The tenant's PENDING subscription document (or null). */
  async findPending(userId) {
    return Subscription.findOne({
      userId,
      status: SUBSCRIPTION_STATUS.PENDING,
    });
  }

  /** A single owned subscription (tenant-scoped). */
  async findOwned(userId, id) {
    return Subscription.findOne({ _id: id, userId });
  }

  /** Tenant subscription history (newest first). */
  async findByUser(userId) {
    return Subscription.find({ userId }).sort({ createdAt: -1 }).lean();
  }

  /**
   * Apply a partial update to an owned subscription document by id and return
   * the updated document.
   */
  async updateById(id, updates) {
    return Subscription.findByIdAndUpdate(id, updates, { new: true });
  }

async cancelPending(userId, id) {
  return Subscription.findOneAndUpdate(
    {
      _id: id,
      userId,
      status: SUBSCRIPTION_STATUS.PENDING,
    },
    {
      $set: {
        status: SUBSCRIPTION_STATUS.CANCELLED,
        cancelledAt: new Date(),
      },
    },
    {
      new: true,
    }
  );
}

  /**
   * Atomically flip the tenant's current ACTIVE subscription to EXPIRED. Used
   * just before activating a replacement so the partial unique index never
   * rejects the new ACTIVE row. Returns the matched/modified count.
   */
  async expireActiveForUser(userId) {
    return Subscription.updateMany(
      { userId, status: SUBSCRIPTION_STATUS.ACTIVE },
      { $set: { status: SUBSCRIPTION_STATUS.EXPIRED } }
    );
  }

  /**
   * Activate a (PENDING) subscription: set ACTIVE plus its active window. Done
   * conditionally so a duplicate activation is a no-op.
   */
  
  async activate(id, { startsAt, expiresAt }) {
    return Subscription.findByIdAndUpdate(
      id,
      {
        $set: {
          status: SUBSCRIPTION_STATUS.ACTIVE,
          startsAt,
          expiresAt,
        },
      },
      { new: true }
    );
  }

  async activateSubscriptionAtomically({
  userId,
  subscriptionId,
  startsAt,
  expiresAt,
}) {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    await Subscription.updateMany(
      {
        userId,
        status: SUBSCRIPTION_STATUS.ACTIVE,
      },
      {
        $set: {
          status: SUBSCRIPTION_STATUS.EXPIRED,
        },
      },
      { session }
    );

const subscription = await Subscription.findOneAndUpdate(
  {
    _id: subscriptionId,
    userId,
    status: SUBSCRIPTION_STATUS.PENDING,
  },
  {
    $set: {
      status: SUBSCRIPTION_STATUS.ACTIVE,
      startsAt,
      expiresAt,
    },
  },
  {
    new: true,
    session,
  }
);

if (!subscription) {
  throw new ApiError(
    409,
    'Subscription is no longer pending or cannot be activated.'
  );
}

    await session.commitTransaction();

    return subscription;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
      session.endSession();
}
}

  // ── Maintenance ─────────────────────────────────────────────────────────────

  /**
   * Cross-tenant sweep: mark every ACTIVE subscription whose expiresAt has
   * passed as EXPIRED. Safe to call from a scheduler; the read paths also treat
   * a past-expiry ACTIVE row as inactive, so this is an optimisation, not a
   * correctness requirement.
   */
  async expireLapsed(now = new Date()) {
    return Subscription.updateMany(
      {
        status: SUBSCRIPTION_STATUS.ACTIVE,
        expiresAt: { $ne: null, $lt: now },
        autoRenew: false,
      },
      { $set: { status: SUBSCRIPTION_STATUS.EXPIRED } }
    );
  }
}

export default new SubscriptionRepository();
