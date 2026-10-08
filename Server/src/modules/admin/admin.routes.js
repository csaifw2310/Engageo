/**
 * @fileoverview Admin Routes — all routes require `protect` + `authorize('admin')`.
 * @module admin/routes
 *
 * Route map:
 *
 *  Dashboard
 *    GET    /api/admin/dashboard
 *
 *  Users
 *    GET    /api/admin/users
 *    GET    /api/admin/users/:id
 *    PATCH  /api/admin/users/:id/suspend
 *    PATCH  /api/admin/users/:id/activate
 *
 *  Plans
 *    GET    /api/admin/plans
 *    POST   /api/admin/plans
 *    PATCH  /api/admin/plans/:id
 *    DELETE /api/admin/plans/:id
 *
 *  Subscriptions
 *    GET    /api/admin/subscriptions
 *    GET    /api/admin/subscriptions/:id
 *    PATCH  /api/admin/subscriptions/:id/cancel
 *    PATCH  /api/admin/subscriptions/:id/upgrade
 *
 *  Payments
 *    GET    /api/admin/payments
 *    GET    /api/admin/payments/:id
 *
 *  Analytics
 *    GET    /api/admin/analytics
 */

import { Router } from "express";

// Auth middleware — adjust import paths to match your project structure
import {
  protect,
  authorize,
} from "../../shared/middlewares/auth.middleware.js";

// Controllers
import {
  getDashboardController,
  listUsersController,
  getUserController,
  suspendUserController,
  activateUserController,
  listPlansController,
  createPlanController,
  updatePlanController,
  deletePlanController,
  listSubscriptionsController,
  getSubscriptionController,
  cancelSubscriptionController,
  upgradeSubscriptionController,
  listPaymentsController,
  getPaymentController,
  getAnalyticsController,
} from "./admin.controller.js";

// Validators
import {
  validateObjectIdParam,
  validateUserListQuery,
  validateCreatePlan,
  validateUpdatePlan,
  validateSubscriptionListQuery,
  validateSubscriptionUpgrade,
  validatePaymentListQuery,
} from "../../shared/validators/admin.validation.js";

const router = Router();

// ---------------------------------------------------------------------------
// Global guard: every route in this module requires authentication + admin role
// ---------------------------------------------------------------------------
router.use(protect, authorize("admin"));

// ===========================================================================
// DASHBOARD
// ===========================================================================

router.get("/dashboard", getDashboardController);

// ===========================================================================
// USERS
// ===========================================================================

router.get("/users", validateUserListQuery, listUsersController);
router.get("/users/:id", validateObjectIdParam, getUserController);
router.patch(
  "/users/:id/suspend",
  validateObjectIdParam,
  suspendUserController,
);
router.patch(
  "/users/:id/activate",
  validateObjectIdParam,
  activateUserController,
);

// ===========================================================================
// PLANS
// ===========================================================================

router.get("/plans", listPlansController);
router.post("/plans", validateCreatePlan, createPlanController);
router.patch(
  "/plans/:id",
  validateObjectIdParam,
  validateUpdatePlan,
  updatePlanController,
);
router.delete("/plans/:id", validateObjectIdParam, deletePlanController);

// ===========================================================================
// SUBSCRIPTIONS
// ===========================================================================

router.get(
  "/subscriptions",
  validateSubscriptionListQuery,
  listSubscriptionsController,
);
router.get(
  "/subscriptions/:id",
  validateObjectIdParam,
  getSubscriptionController,
);
router.patch(
  "/subscriptions/:id/cancel",
  validateObjectIdParam,
  cancelSubscriptionController,
);
router.patch(
  "/subscriptions/:id/upgrade",
  validateObjectIdParam,
  validateSubscriptionUpgrade,
  upgradeSubscriptionController,
);

// ===========================================================================
// PAYMENTS
// ===========================================================================

router.get("/payments", validatePaymentListQuery, listPaymentsController);
router.get("/payments/:id", validateObjectIdParam, getPaymentController);

// ===========================================================================
// ANALYTICS
// ===========================================================================

router.get("/analytics", getAnalyticsController);

export default router;
