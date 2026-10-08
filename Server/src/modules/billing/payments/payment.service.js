import paymentRepository from './payment.repository.js';
import subscriptionService from '../subscriptions/subscription.service.js';
import razorpay from '../razorpay/razorpay.client.js';
import ApiError from '../../../utils/ApiError.js';
import notificationEvents from '../../notifications/notification.events.js';
import {
  BILLING_PAGINATION,
  RAZORPAY_EVENT,
  BILLING_MESSAGES,
} from '../billing.constants.js';

/**
 * Payment service.
 *
 * Owns the read side of the money trail (history + single payment) and the two
 * confirmation paths that turn a PENDING payment into an ACTIVE subscription:
 *
 *   1. verifyPayment()   — the synchronous Razorpay Checkout callback, signed
 *                          with the API secret.
 *   2. handleWebhook()   — the asynchronous server-to-server event, signed with
 *                          the webhook secret against the RAW request body.
 *
 * Both converge on the same idempotent core: atomically flip the payment to
 * SUCCESS (a no-op if already processed) and, only on a real transition,
 * activate the funded subscription. Razorpay delivers webhooks at-least-once,
 * so this idempotency is essential — a duplicate event can never grant a second
 * period of access.
 *
 * Activation lives in the subscription service; this service never touches the
 * Subscription collection directly.
 */
class PaymentService {
  // ── Reads (tenant-scoped) ─────────────────────────────────────────────────

  /** Paginated payment history for the tenant. */
  async listPayments(userId, query = {}) {
    const page = Math.max(
      parseInt(query.page, 10) || BILLING_PAGINATION.DEFAULT_PAGE,
      1
    );
    const limit = Math.min(
      Math.max(parseInt(query.limit, 10) || BILLING_PAGINATION.DEFAULT_LIMIT, 1),
      BILLING_PAGINATION.MAX_LIMIT
    );
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      paymentRepository.findByUser(userId, { skip, limit }),
      paymentRepository.countByUser(userId),
    ]);

    return {
      payments,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 0,
      },
    };
  }

  /** A single owned payment (404 if missing or not owned). */
  async getPayment(userId, id) {
    const payment = await paymentRepository.findOwned(userId, id);
    if (!payment) throw new ApiError(404, BILLING_MESSAGES.PAYMENT_NOT_FOUND);
    return payment;
  }

  // ── Checkout verification (tenant-scoped) ─────────────────────────────────

  /**
   * Verify a Razorpay Checkout success callback and, on first confirmation,
   * activate the funded subscription.
   *
   * Tenant-scoped: the payment must belong to the calling tenant. Idempotent: a
   * repeated call after the payment is already SUCCESS returns the existing
   * payment without re-activating.
   */
  async verifyPayment(userId, { razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    const valid = razorpay.verifyPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });
    if (!valid) {
      throw new ApiError(400, BILLING_MESSAGES.PAYMENT_SIGNATURE_INVALID);
    }

    const payment = await paymentRepository.findByOrderId(razorpayOrderId);
    // Don't leak existence of other tenants' payments — treat a foreign or
    // missing order as a plain not-found.
    if (!payment || String(payment.userId) !== String(userId)) {
      throw new ApiError(404, BILLING_MESSAGES.PAYMENT_NOT_FOUND);
    }

    const confirmed = await this.#confirmAndActivate(payment._id, razorpayPaymentId);

    return {
      payment: confirmed.payment,
      subscription: confirmed.subscription,
      alreadyProcessed: confirmed.alreadyProcessed,
    };
  }

  // ── Webhook (NOT tenant-scoped — verified by signature) ─────────────────────

  /**
   * Process a Razorpay webhook. The signature is checked against the EXACT raw
   * body; tenant identity is recovered from the matched payment, never trusted
   * from the payload.
   *
   * Handles payment.captured / order.paid (→ confirm + activate) and
   * payment.failed (→ mark failed). Unknown events are acknowledged and ignored
   * for forward compatibility. Always idempotent.
   *
   * @param {Buffer|string} rawBody   Untouched request body.
   * @param {string}        signature x-razorpay-signature header value.
   * @returns {Promise<{event:string, handled:boolean}>}
   */
  async handleWebhook(rawBody, signature) {
    if (!razorpay.verifyWebhookSignature(rawBody, signature)) {
      throw new ApiError(400, BILLING_MESSAGES.WEBHOOK_SIGNATURE_INVALID);
    }

    const payload = this.#parseRaw(rawBody);
    const event = payload?.event || null;

    switch (event) {
      case RAZORPAY_EVENT.PAYMENT_CAPTURED:
      case RAZORPAY_EVENT.ORDER_PAID: {
        const { orderId, paymentId } = this.#extractOrderRefs(payload);
        if (orderId) {
          const payment = await paymentRepository.findByOrderId(orderId);
          if (payment) await this.#confirmAndActivate(payment._id, paymentId);
        }
        return { event, handled: true };
      }

      case RAZORPAY_EVENT.PAYMENT_FAILED: {
        const { orderId, paymentId } = this.#extractOrderRefs(payload);
        if (orderId) {
          const payment = await paymentRepository.findByOrderId(orderId);
          if (payment) {
              const failedPayment = await paymentRepository.markFailedIfPending(
                payment._id,
                {
                  metadata: {
                    ...payment.metadata,
                    failedPaymentId: paymentId || null,
                  },
  }
);

if (failedPayment) {
  await subscriptionService.cancelPendingSubscription(
    payment.userId,
    payment.subscriptionId
  );
  notificationEvents.paymentFailed(payment.userId, failedPayment);
}
          }
        }
        return { event, handled: true };
      }

      default:
        // Acknowledge anything we don't act on so Razorpay stops retrying.
        return { event, handled: false };
    }
  }

  // ── Internal helpers ─────────────────────────────────────────────────────────

  /**
   * Atomically confirm a payment and, only on a genuine PENDING→SUCCESS
   * transition, activate its subscription. Returns the resulting payment, the
   * (possibly newly) active subscription, and whether the payment had already
   * been processed.
   */
  async #confirmAndActivate(paymentId, razorpayPaymentId) {
    const updated = await paymentRepository.markSuccessIfPending(paymentId, {
      razorpayPaymentId,
      paidAt: new Date(),
    });

    if (!updated) {
      // Already processed (duplicate callback / repeated verify). The payment is
      // already SUCCESS and its subscription already activated — return the
      // current payment unchanged. Fully idempotent.
      const existing = await paymentRepository.findById(paymentId);
      return {
        payment: existing,
        subscription: null,
        alreadyProcessed: true,
      };
    }

    const subscription = await subscriptionService.activateForPayment(updated);

    notificationEvents.paymentSuccess(updated.userId, updated);

    return { payment: updated, subscription, alreadyProcessed: false };
  }

  /** Parse the raw webhook body into an object (tolerant of Buffer/string). */
  #parseRaw(rawBody) {
    try {
      const text = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  /**
   * Pull the order id (and payment id when present) out of a Razorpay webhook
   * payload, tolerating both the `payment.entity` and `order.entity` shapes.
   */
  #extractOrderRefs(payload) {
    const paymentEntity = payload?.payload?.payment?.entity;
    const orderEntity = payload?.payload?.order?.entity;

    const orderId = paymentEntity?.order_id || orderEntity?.id || null;
    const paymentId = paymentEntity?.id || null;

    return { orderId, paymentId };
  }
}

export default new PaymentService();
