import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import paymentService from './payment.service.js';
import { RAZORPAY, BILLING_MESSAGES } from '../billing.constants.js';

/**
 * Payment controllers. Thin HTTP adapters over the payment service.
 *
 * The read + verify handlers are tenant-scoped (req.user.id, set by `protect`).
 * The webhook handler is NOT — it is called by Razorpay's servers, so it has no
 * authenticated tenant and instead trusts the HMAC signature the service
 * verifies against the raw request body.
 */

// GET /api/payments  → paginated history.
const getPayments = asyncHandler(async (req, res) => {
  const data = await paymentService.listPayments(req.user.id, req.query);
  res
    .status(200)
    .json(new ApiResponse(200, data, BILLING_MESSAGES.PAYMENT_LIST_FETCHED));
});

// GET /api/payments/:id  → single owned payment.
const getPayment = asyncHandler(async (req, res) => {
  const data = await paymentService.getPayment(req.user.id, req.params.id);
  res
    .status(200)
    .json(new ApiResponse(200, data, BILLING_MESSAGES.PAYMENT_FETCHED));
});

// POST /api/payments/verify  → Razorpay Checkout success callback.
const verifyPayment = asyncHandler(async (req, res) => {
  const data = await paymentService.verifyPayment(req.user.id, {
    razorpayOrderId: req.body.razorpay_order_id,
    razorpayPaymentId: req.body.razorpay_payment_id,
    razorpaySignature: req.body.razorpay_signature,
  });
  res
    .status(200)
    .json(new ApiResponse(200, data, BILLING_MESSAGES.PAYMENT_VERIFIED));
});

// POST /api/payments/webhook  → Razorpay server-to-server event (public).
const handleWebhook = asyncHandler(async (req, res) => {
  // The raw body is captured by the express.json `verify` hook in app.js so the
  // signature can be checked against the exact bytes Razorpay signed.
  console.log("=== WEBHOOK HIT ==="); // DEBUG
  const signature = req.get(RAZORPAY.SIGNATURE_HEADER);
  const data = await paymentService.handleWebhook(req.rawBody, signature);
  res.status(200).json(new ApiResponse(200, data, BILLING_MESSAGES.WEBHOOK_PROCESSED));
});

export { getPayments, getPayment, verifyPayment, handleWebhook };
