import express from 'express';

import { protect } from '../../../shared/middlewares/auth.middleware.js';
import validate from '../../../shared/middlewares/validate.middleware.js';
import * as controller from './payment.controller.js';
import * as v from './../../../shared/validators/payment.validation.js';

const paymentRouter = express.Router();

/**
 * Payment routes.
 *
 * The webhook is declared FIRST and is deliberately public — Razorpay's servers
 * call it without a tenant JWT, and authenticity is established by the HMAC
 * signature (verified against the raw body in the service), not by `protect`.
 *
 * Every other route is tenant-scoped behind `protect`. The static /verify route
 * is declared before "/:id" so it never falls through to the param matcher.
 */

// Public, signature-verified.
paymentRouter.post('/webhook', v.webhook, validate, controller.handleWebhook);

// Authenticated tenant routes.
paymentRouter.use(protect);

paymentRouter.post('/verify', v.verifyPayment, validate, controller.verifyPayment);

paymentRouter.get('/', v.listPayments, validate, controller.getPayments);
paymentRouter.get('/:id', v.paymentIdParam, validate, controller.getPayment);

export default paymentRouter;
