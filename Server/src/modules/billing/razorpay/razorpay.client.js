import crypto from 'node:crypto';

import ApiError from '../../../utils/ApiError.js';
import {
  RAZORPAY,
  BILLING_MESSAGES,
  getRazorpayKeyId,
  getRazorpayKeySecret,
  getRazorpayWebhookSecret,
} from '../billing.constants.js';

/**
 * Razorpay integration client.
 *
 * Deliberately depends on NO third-party SDK — it talks to Razorpay's REST API
 * with the runtime's built-in `fetch` and verifies signatures with the built-in
 * `crypto` module. This keeps the billing module free of an extra production
 * dependency and means signature verification uses the exact same primitives
 * the rest of the platform already trusts.
 *
 * Three responsibilities only:
 *   1. createOrder()        — open a Razorpay order for a paid subscription.
 *   2. verifyPaymentSignature() — validate the client-checkout callback.
 *   3. verifyWebhookSignature() — validate server-to-server webhook calls.
 *
 * Secrets are read lazily (via the constants' getters) so this file imports
 * cleanly even when Razorpay is not configured; a missing key only surfaces as
 * a 503 when a paid flow is actually attempted.
 */
class RazorpayClient {
  /** True only when both API credentials are present. */
  isConfigured() {
    return Boolean(getRazorpayKeyId() && getRazorpayKeySecret());
  }

  /** Throw a clear 503 when a paid flow is attempted without credentials. */
  #assertConfigured() {
    if (!this.isConfigured()) {
      throw new ApiError(503, BILLING_MESSAGES.RAZORPAY_NOT_CONFIGURED);
    }
  }

  /** HTTP Basic auth header value for key_id:key_secret. */
  #authHeader() {
    const raw = `${getRazorpayKeyId()}:${getRazorpayKeySecret()}`;
    return `Basic ${Buffer.from(raw).toString('base64')}`;
  }

  /**
   * Create a Razorpay order.
   *
   * @param {object} params
   * @param {number} params.amount   Amount in the smallest currency sub-unit
   *                                  (paise). Callers convert rupees → paise.
   * @param {string} params.currency ISO currency code (e.g. "INR").
   * @param {string} params.receipt  Caller-side correlation id (≤ 40 chars).
   * @param {object} [params.notes]  Free-form key/value metadata echoed back by
   *                                  Razorpay and persisted on the payment.
   * @returns {Promise<object>} The created Razorpay order (contains `id`).
   */
  async createOrder({ amount, currency = RAZORPAY.DEFAULT_CURRENCY, receipt, notes = {} }) {
    this.#assertConfigured();

    let response;
    try {
      response = await fetch(RAZORPAY.ORDERS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.#authHeader(),
        },
        body: JSON.stringify({
          amount,
          currency,
          receipt,
          notes,
          // Capture automatically so a successful payment.captured webhook is
          // emitted without a manual capture step.
          payment_capture: 1,
        }),
      });
    } catch {
      // Network/transport failure — never leak internals to the client.
      throw new ApiError(502, BILLING_MESSAGES.RAZORPAY_ORDER_FAILED);
    }

    const body = await response.json().catch(() => ({}));

    if (!response.ok || !body?.id) {
      throw new ApiError(502, BILLING_MESSAGES.RAZORPAY_ORDER_FAILED, [
        { provider: 'razorpay', detail: body?.error?.description || null },
      ]);
    }

    return body;
  }

  /**
   * Verify a Razorpay Checkout callback signature.
   *
   * Razorpay signs `${orderId}|${paymentId}` with the API key secret using
   * HMAC-SHA256. Comparison is constant-time to avoid timing oracles.
   *
   * @returns {boolean} true when the signature is authentic.
   */
  verifyPaymentSignature({ orderId, paymentId, signature }) {
    if (!orderId || !paymentId || !signature) return false;

    const expected = crypto
      .createHmac('sha256', getRazorpayKeySecret())
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    return this.#timingSafeEqualHex(expected, signature);
  }

  /**
   * Verify a Razorpay webhook signature.
   *
   * The signature is HMAC-SHA256 of the EXACT raw request body using the
   * configured webhook secret. The raw body (not the re-serialised parsed
   * object) must be supplied by the caller — see the rawBody capture in app.js.
   *
   * @param {Buffer|string} rawBody   Untouched request body bytes.
   * @param {string}        signature Value of the x-razorpay-signature header.
   * @returns {boolean}
   */
  verifyWebhookSignature(rawBody, signature) {
    const secret = getRazorpayWebhookSecret();
    if (!secret || !signature || rawBody == null) return false;

    const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody));

    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return this.#timingSafeEqualHex(expected, signature);
  }

  /** Constant-time comparison of two hex digests of equal length. */
  #timingSafeEqualHex(a, b) {
    const bufA = Buffer.from(String(a), 'hex');
    const bufB = Buffer.from(String(b), 'hex');
    if (bufA.length !== bufB.length || bufA.length === 0) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }
}

export default new RazorpayClient();
