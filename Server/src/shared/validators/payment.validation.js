import { body, param, query, header } from 'express-validator';

import {
  BILLING_PAGINATION,
  RAZORPAY,
} from '../../modules/billing/billing.constants.js';

/**
 * express-validator chains for the Payments sub-module. The Razorpay payloads
 * (the Checkout callback and the webhook) are validated here per the module's
 * security requirement to "Validate Razorpay Payloads" before any signature
 * work or DB access happens.
 */

// GET /api/payments/:id
const paymentIdParam = [
  param('id').isMongoId().withMessage('Invalid payment id'),
];

// GET /api/payments  → pagination
const listPayments = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be an integer >= 1')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: BILLING_PAGINATION.MAX_LIMIT })
    .withMessage(`limit must be between 1 and ${BILLING_PAGINATION.MAX_LIMIT}`)
    .toInt(),
];

// POST /api/payments/verify  → Razorpay Checkout success callback.
const verifyPayment = [
  body('razorpay_order_id')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('razorpay_order_id is required'),
  body('razorpay_payment_id')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('razorpay_payment_id is required'),
  body('razorpay_signature')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('razorpay_signature is required'),
];

// POST /api/payments/webhook  → require the signature header to be present.
// The body itself is verified by HMAC against the raw bytes in the service, so
// only the header is asserted here (a missing header is a fast 422 reject).
const webhook = [
  header(RAZORPAY.SIGNATURE_HEADER)
    .exists()
    .withMessage('Missing Razorpay signature header'),
];

export { paymentIdParam, listPayments, verifyPayment, webhook };
