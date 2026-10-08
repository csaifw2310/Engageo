import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import subscriptionService from './subscription.service.js';
import { BILLING_MESSAGES } from '../billing.constants.js';

/**
 * Subscription controllers. Thin HTTP adapters over the subscription service.
 * The authenticated tenant is always taken from req.user.id (set by `protect`),
 * never from the request body, so a tenant can only ever act on its own
 * subscription.
 */

// GET /api/subscriptions/current
const getCurrentSubscription = asyncHandler(async (req, res) => {
  const data = await subscriptionService.getCurrentSubscription(req.user.id);
  res
    .status(200)
    .json(new ApiResponse(200, data, BILLING_MESSAGES.SUBSCRIPTION_FETCHED));
});

// POST /api/subscriptions
const createSubscription = asyncHandler(async (req, res) => {
  const data = await subscriptionService.createSubscription(req.user.id, req.body);
  res
    .status(201)
    .json(new ApiResponse(201, data, BILLING_MESSAGES.SUBSCRIPTION_CREATED));
});

// POST /api/subscriptions/upgrade
const upgradeSubscription = asyncHandler(async (req, res) => {
  const data = await subscriptionService.upgradeSubscription(req.user.id, req.body);
  res
    .status(200)
    .json(new ApiResponse(200, data, BILLING_MESSAGES.SUBSCRIPTION_UPGRADED));
});

// POST /api/subscriptions/cancel
const cancelSubscription = asyncHandler(async (req, res) => {
  const data = await subscriptionService.cancelSubscription(req.user.id);
  res
    .status(200)
    .json(new ApiResponse(200, data, BILLING_MESSAGES.SUBSCRIPTION_CANCELLED));
});

export {
  getCurrentSubscription,
  createSubscription,
  upgradeSubscription,
  cancelSubscription,
};
