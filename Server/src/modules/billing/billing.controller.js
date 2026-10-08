import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import billingService from './billing.service.js';
import { BILLING_MESSAGES } from './billing.constants.js';

/**
 * Billing controllers — the dashboard surface. Thin HTTP adapter over the
 * billing service; the tenant is taken from req.user.id (set by `protect`).
 */

// GET /api/billing/summary
const getSummary = asyncHandler(async (req, res) => {
  const data = await billingService.getSummary(req.user.id);
  res.status(200).json(new ApiResponse(200, data, BILLING_MESSAGES.SUMMARY_FETCHED));
});

export { getSummary };
