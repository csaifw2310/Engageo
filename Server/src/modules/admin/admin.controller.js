/**
 * @fileoverview Admin Controller — HTTP request/response handling for the Admin module.
 * Delegates all business logic to the service layer.
 * @module admin/controller
 */

import {
  getDashboard,
  listUsers,
  getUserProfile,
  suspendUser,
  activateUser,
  listPlans,
  addPlan,
  editPlan,
  removePlan,
  listSubscriptions,
  getSubscriptionDetail,
  cancelSubscription,
  upgradeSubscription,
  listPayments,
  getPaymentDetail,
  getAnalytics,
} from './admin.service.js';

import { parsePagination } from '../../shared/validators/admin.validation.js';

// ---------------------------------------------------------------------------
// Utility: wraps async route handlers and forwards errors to Express
// ---------------------------------------------------------------------------

/**
 * @param {Function} fn - Async Express route handler
 * @returns {Function} Express middleware
 */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ===========================================================================
// DASHBOARD
// ===========================================================================

/**
 * GET /api/admin/dashboard
 * Returns platform-wide SaaS statistics.
 */
export const getDashboardController = asyncHandler(async (req, res) => {
  const data = await getDashboard();
  return res.status(200).json({ success: true, data });
});

// ===========================================================================
// USERS
// ===========================================================================

/**
 * GET /api/admin/users
 * Lists users with pagination, search, and filters.
 */
export const listUsersController = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const { search, role, status } = req.query;

  const result = await listUsers({ page, limit, search, role, status });
  return res.status(200).json({ success: true, ...result });
});

/**
 * GET /api/admin/users/:id
 * Returns complete user profile.
 */
export const getUserController = asyncHandler(async (req, res) => {
  const data = await getUserProfile(req.params.id);
  return res.status(200).json({ success: true, data });
});

/**
 * PATCH /api/admin/users/:id/suspend
 * Suspends a user account.
 */
export const suspendUserController = asyncHandler(async (req, res) => {
  const result = await suspendUser(req.params.id);
  return res.status(200).json(result);
});

/**
 * PATCH /api/admin/users/:id/activate
 * Activates a suspended user account.
 */
export const activateUserController = asyncHandler(async (req, res) => {
  const result = await activateUser(req.params.id);
  return res.status(200).json(result);
});

// ===========================================================================
// PLANS
// ===========================================================================

/**
 * GET /api/admin/plans
 * Lists all active plans.
 */
export const listPlansController = asyncHandler(async (req, res) => {
  const plans = await listPlans();
  return res.status(200).json({ success: true, plans });
});

/**
 * POST /api/admin/plans
 * Creates a new plan.
 */
export const createPlanController = asyncHandler(async (req, res) => {
  const result = await addPlan(req.body);
  return res.status(201).json(result);
});

/**
 * PATCH /api/admin/plans/:id
 * Updates an existing plan.
 */
export const updatePlanController = asyncHandler(async (req, res) => {
  const result = await editPlan(req.params.id, req.body);
  return res.status(200).json(result);
});

/**
 * DELETE /api/admin/plans/:id
 * Soft-deletes a plan (sets isActive: false).
 */
export const deletePlanController = asyncHandler(async (req, res) => {
  const result = await removePlan(req.params.id);
  return res.status(200).json(result);
});

// ===========================================================================
// SUBSCRIPTIONS
// ===========================================================================

/**
 * GET /api/admin/subscriptions
 * Lists all subscriptions with optional filters.
 */
export const listSubscriptionsController = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const { status } = req.query;

  const result = await listSubscriptions({ page, limit, status });
  return res.status(200).json({ success: true, ...result });
});

/**
 * GET /api/admin/subscriptions/:id
 * Returns full details for a single subscription.
 */
export const getSubscriptionController = asyncHandler(async (req, res) => {
  const data = await getSubscriptionDetail(req.params.id);
  return res.status(200).json({ success: true, data });
});

/**
 * PATCH /api/admin/subscriptions/:id/cancel
 * Admin cancels a subscription.
 */
export const cancelSubscriptionController = asyncHandler(async (req, res) => {
  const result = await cancelSubscription(req.params.id);
  return res.status(200).json(result);
});

/**
 * PATCH /api/admin/subscriptions/:id/upgrade
 * Admin upgrades a subscription to a different plan.
 */
export const upgradeSubscriptionController = asyncHandler(async (req, res) => {
  const { planId } = req.body;
  const result = await upgradeSubscription(req.params.id, planId);
  return res.status(200).json(result);
});

// ===========================================================================
// PAYMENTS
// ===========================================================================

/**
 * GET /api/admin/payments
 * Lists all payments with optional filters and search.
 */
export const listPaymentsController = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const { status, search } = req.query;

  const result = await listPayments({ page, limit, status, search });
  return res.status(200).json({ success: true, ...result });
});

/**
 * GET /api/admin/payments/:id
 * Returns full details for a single payment.
 */
export const getPaymentController = asyncHandler(async (req, res) => {
  const data = await getPaymentDetail(req.params.id);
  return res.status(200).json({ success: true, data });
});

// ===========================================================================
// ANALYTICS
// ===========================================================================

/**
 * GET /api/admin/analytics
 * Returns platform-wide analytics aggregated across all tenants.
 */
export const getAnalyticsController = asyncHandler(async (req, res) => {
  const data = await getAnalytics();
  return res.status(200).json({ success: true, data });
});
