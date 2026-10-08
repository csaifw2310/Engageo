/**
 * @fileoverview Admin module constants for Engageo SaaS Platform
 * @module admin/constants
 */

/** @enum {string} Admin-related error messages */
export const ADMIN_ERRORS = {
  USER_NOT_FOUND: 'User not found',
  PLAN_NOT_FOUND: 'Plan not found',
  SUBSCRIPTION_NOT_FOUND: 'Subscription not found',
  PAYMENT_NOT_FOUND: 'Payment not found',
  PLAN_IN_USE: 'Plan is referenced by active subscriptions and cannot be deleted',
  USER_ALREADY_SUSPENDED: 'User is already suspended',
  USER_ALREADY_ACTIVE: 'User is already active',
  CANNOT_SUSPEND_ADMIN: 'Cannot suspend an admin account',
  INVALID_PLAN_ID: 'Invalid plan ID provided',
};

/** @enum {string} Admin-related success messages */
export const ADMIN_SUCCESS = {
  USER_SUSPENDED: 'User suspended successfully',
  USER_ACTIVATED: 'User activated successfully',
  PLAN_CREATED: 'Plan created successfully',
  PLAN_UPDATED: 'Plan updated successfully',
  PLAN_DELETED: 'Plan deactivated successfully',
  SUBSCRIPTION_CANCELLED: 'Subscription cancelled successfully',
  SUBSCRIPTION_UPGRADED: 'Subscription upgraded successfully',
};

/** @enum {string} User status values */
export const USER_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  INACTIVE: 'inactive',
};

/** @enum {string} Subscription status values (matches billing.constants.js) */
export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'ACTIVE',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
};

/** @enum {string} Payment status values */
export const PAYMENT_STATUS = {
  SUCCESS: 'success',
  FAILED: 'failed',
  PENDING: 'pending',
};

/** @enum {string} User roles */
export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
};

/** @enum {string} Billing cycle values */
export const BILLING_CYCLE = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
};

/** Default pagination settings */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
};

/** Represents unlimited usage for plan limits */
export const UNLIMITED = -1;