import express from 'express';

import { protect } from '../../shared/middlewares/auth.middleware.js';
import * as controller from './billing.controller.js';

const billingRouter = express.Router();

/**
 * Billing dashboard routes. Tenant-scoped behind `protect`.
 *   GET /api/billing/summary → effective plan + usage vs limits.
 */
billingRouter.use(protect);

billingRouter.get('/summary', controller.getSummary);

export default billingRouter;
