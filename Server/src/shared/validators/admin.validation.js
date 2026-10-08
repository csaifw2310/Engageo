/**
 * @fileoverview Validation schemas for Admin module
 * @module admin/validation
 */

import { PAYMENT_STATUS, SUBSCRIPTION_STATUS, USER_ROLES, USER_STATUS, BILLING_CYCLE } from '../../modules/admin/admin.constants.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validates pagination query params.
 * @param {object} query
 * @returns {{ page: number, limit: number }}
 */
export const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  return { page, limit };
};

/**
 * Asserts a value is a valid MongoDB ObjectId string.
 * @param {string} id
 * @returns {boolean}
 */
export const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(id);

// ---------------------------------------------------------------------------
// Middleware validators (Express-compatible)
// ---------------------------------------------------------------------------

/**
 * Validates query params for GET /admin/users
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const validateUserListQuery = (req, res, next) => {
  const { role, status } = req.query;

  if (role && !Object.values(USER_ROLES).includes(role)) {
    return res.status(400).json({
      success: false,
      message: `Invalid role filter. Allowed values: ${Object.values(USER_ROLES).join(', ')}`,
    });
  }

  if (status && !Object.values(USER_STATUS).includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status filter. Allowed values: ${Object.values(USER_STATUS).join(', ')}`,
    });
  }

  next();
};

/**
 * Validates :id param as a MongoDB ObjectId
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const validateObjectIdParam = (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid ID format' });
  }
  next();
};

/**
 * Validates POST /admin/plans body
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const validateCreatePlan = (req, res, next) => {
  const {
    name,
    priceMonthly,
    priceYearly,
    maxContacts,
    maxGroups,
    maxTemplates,
    maxCampaignsPerMonth,
    maxMessagesPerMonth,
  } = req.body;

  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('name is required and must be at least 2 characters');
  }

  const numericFields = { priceMonthly, priceYearly };
  for (const [field, val] of Object.entries(numericFields)) {
    if (val === undefined || val === null || isNaN(Number(val)) || Number(val) < 0) {
      errors.push(`${field} must be a non-negative number`);
    }
  }

  const limitFields = { maxContacts, maxGroups, maxTemplates, maxCampaignsPerMonth, maxMessagesPerMonth };
  for (const [field, val] of Object.entries(limitFields)) {
    if (val !== undefined) {
      const n = Number(val);
      if (isNaN(n) || (n < -1)) {
        errors.push(`${field} must be -1 (unlimited) or a positive integer`);
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  next();
};

/**
 * Validates PATCH /admin/plans/:id body
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const validateUpdatePlan = (req, res, next) => {
  const allowedFields = [
    'name', 'description', 'priceMonthly', 'priceYearly',
    'maxContacts', 'maxGroups', 'maxTemplates',
    'maxCampaignsPerMonth', 'maxMessagesPerMonth', 'features',
  ];

  const body = req.body;

  if (!body || Object.keys(body).length === 0) {
    return res.status(400).json({ success: false, message: 'Request body must not be empty' });
  }

  const unknownFields = Object.keys(body).filter((k) => !allowedFields.includes(k));
  if (unknownFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Unknown fields: ${unknownFields.join(', ')}`,
    });
  }

  const errors = [];

  const priceFields = ['priceMonthly', 'priceYearly'];
  for (const field of priceFields) {
    if (body[field] !== undefined) {
      const n = Number(body[field]);
      if (isNaN(n) || n < 0) errors.push(`${field} must be a non-negative number`);
    }
  }

  const limitFields = ['maxContacts', 'maxGroups', 'maxTemplates', 'maxCampaignsPerMonth', 'maxMessagesPerMonth'];
  for (const field of limitFields) {
    if (body[field] !== undefined) {
      const n = Number(body[field]);
      if (isNaN(n) || n < -1) errors.push(`${field} must be -1 (unlimited) or a positive integer`);
    }
  }

  if (body.features !== undefined && !Array.isArray(body.features)) {
    errors.push('features must be an array');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  next();
};

/**
 * Validates PATCH /admin/subscriptions/:id/upgrade body
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const validateSubscriptionUpgrade = (req, res, next) => {
  const { planId } = req.body;

  if (!planId || !isValidObjectId(planId)) {
    return res.status(400).json({ success: false, message: 'A valid planId is required' });
  }

  next();
};

/**
 * Validates query params for GET /admin/subscriptions
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const validateSubscriptionListQuery = (req, res, next) => {
  const { status } = req.query;

  if (status && !Object.values(SUBSCRIPTION_STATUS).includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status filter. Allowed values: ${Object.values(SUBSCRIPTION_STATUS).join(', ')}`,
    });
  }

  next();
};

/**
 * Validates query params for GET /admin/payments
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const validatePaymentListQuery = (req, res, next) => {
  const { status } = req.query;

  if (status && !Object.values(PAYMENT_STATUS).includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status filter. Allowed values: ${Object.values(PAYMENT_STATUS).join(', ')}`,
    });
  }

  next();
};
