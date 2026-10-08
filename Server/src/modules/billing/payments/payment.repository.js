import Payment from './payment.model.js';
import { PAYMENT_STATUS } from '../billing.constants.js';

/**
 * Payment data-access layer (Repository Pattern).
 *
 * The ONLY place the Payment collection is touched. Read methods are
 * tenant-scoped (filtered by userId). The webhook lookup (`findByOrderId`) is
 * intentionally NOT tenant-scoped — a webhook arrives without an authenticated
 * tenant, and tenant identity is recovered FROM the matched payment document.
 */
class PaymentRepository {
  async create(data) {
    return Payment.create(data);
  }

  /** Tenant-scoped paginated history (newest first). */
  async findByUser(userId, { skip, limit }) {
    return Payment.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  /** Count a tenant's payments (pagination envelope). */
  async countByUser(userId) {
    return Payment.countDocuments({ userId });
  }

  /** A single owned payment (tenant-scoped; null if not found or not owned). */
  async findOwned(userId, id) {
    return Payment.findOne({ _id: id, userId }).lean();
  }

  /** A single payment by id, not tenant-scoped (internal idempotency re-reads). */
  async findById(id) {
    return Payment.findById(id).lean();
  }

  /**
   * Resolve a payment by its Razorpay order id (webhook lookup). NOT
   * tenant-scoped by design — the order id is globally unique and the tenant is
   * read back from the document.
   */
  async findByOrderId(razorpayOrderId) {
    return Payment.findOne({ razorpayOrderId });
  }

  /**
   * Atomically mark a PENDING payment SUCCESS. Conditional on the current status
   * being PENDING, so a duplicate/at-least-once webhook is a no-op (returns
   * null) and can never trigger a second activation.
   *
   * @returns {Promise<object|null>} the updated payment, or null if it was not
   *   PENDING (already processed).
   */
  async markSuccessIfPending(id, { razorpayPaymentId, paidAt, metadata }) {
    return Payment.findOneAndUpdate(
      { _id: id, status: PAYMENT_STATUS.PENDING },
      {
        $set: {
          status: PAYMENT_STATUS.SUCCESS,
          razorpayPaymentId: razorpayPaymentId || null,
          paidAt: paidAt || new Date(),
          ...(metadata ? { metadata } : {}),
        },
      },
      { new: true }
    );
  }

  /**
   * Atomically mark a PENDING payment FAILED. Conditional on PENDING so a late
   * success is never overwritten by a stale failure.
   */
  async markFailedIfPending(id, { metadata } = {}) {
    return Payment.findOneAndUpdate(
      { _id: id, status: PAYMENT_STATUS.PENDING },
      {
        $set: {
          status: PAYMENT_STATUS.FAILED,
          ...(metadata ? { metadata } : {}),
        },
      },
      { new: true }
    );
  }

  async markFailedBySubscriptionIfPending(subscriptionId, { metadata } = {}) {
  return Payment.findOneAndUpdate(
    {
      subscriptionId,
      status: PAYMENT_STATUS.PENDING,
    },
    {
      $set: {
        status: PAYMENT_STATUS.FAILED,
        ...(metadata ? { metadata } : {}),
      },
    },
    {
      new: true,
    }
  );
}
}

export default new PaymentRepository();
