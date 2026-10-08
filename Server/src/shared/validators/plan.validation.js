import { body, param } from 'express-validator';

import { PLAN_LIMITS, UNLIMITED } from '../../modules/billing/billing.constants.js';

/**
 * express-validator chains for the Plans sub-module. Each chain is an array
 * mounted BEFORE the shared `validate` middleware:
 *   router.post('/', createPlan, validate, controller.createPlan)
 *
 * Following the Analytics module's precedent, the validation layer lives inside
 * the module folder rather than under src/shared/validators.
 */

// Reusable :id check.
const planIdParam = [param('id').isMongoId().withMessage('Invalid plan id')];

// POST /api/plans  (admin)
const createPlan = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('name is required')
    .isLength({ max: PLAN_LIMITS.NAME_MAX })
    .withMessage(`name cannot exceed ${PLAN_LIMITS.NAME_MAX} characters`),
  body('description')
    .optional()
    .trim()
    .isLength({ max: PLAN_LIMITS.DESCRIPTION_MAX })
    .withMessage(
      `description cannot exceed ${PLAN_LIMITS.DESCRIPTION_MAX} characters`
    ),
  body('priceMonthly')
    .exists()
    .withMessage('priceMonthly is required')
    .isFloat({ min: 0 })
    .withMessage('priceMonthly must be a non-negative number')
    .toFloat(),
  body('priceYearly')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('priceYearly must be a non-negative number')
    .toFloat(),
  body('maxContacts')
    .exists()
    .withMessage('maxContacts is required')
    .isInt({ min: UNLIMITED })
    .withMessage('maxContacts must be -1 (unlimited) or a non-negative integer')
    .toInt(),
  body('maxCampaignsPerMonth')
    .exists()
    .withMessage('maxCampaignsPerMonth is required')
    .isInt({ min: UNLIMITED })
    .withMessage(
      'maxCampaignsPerMonth must be -1 (unlimited) or a non-negative integer'
    )
    .toInt(),
  body('maxMessagesPerMonth')
    .exists()
    .withMessage('maxMessagesPerMonth is required')
    .isInt({ min: UNLIMITED })
    .withMessage(
      'maxMessagesPerMonth must be -1 (unlimited) or a non-negative integer'
    )
    .toInt(),
  body('features')
    .optional()
    .isArray({ max: PLAN_LIMITS.MAX_FEATURES })
    .withMessage(`features must be an array of at most ${PLAN_LIMITS.MAX_FEATURES}`),
  body('features.*')
    .optional()
    .isString()
    .trim()
    .isLength({ max: PLAN_LIMITS.FEATURE_MAX })
    .withMessage(`each feature cannot exceed ${PLAN_LIMITS.FEATURE_MAX} characters`),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
    .toBoolean(),
];

// PATCH /api/plans/:id  (admin) — every field optional, but at least the id valid.
const updatePlan = [
  ...planIdParam,
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('name cannot be empty')
    .isLength({ max: PLAN_LIMITS.NAME_MAX })
    .withMessage(`name cannot exceed ${PLAN_LIMITS.NAME_MAX} characters`),
  body('description')
    .optional()
    .trim()
    .isLength({ max: PLAN_LIMITS.DESCRIPTION_MAX })
    .withMessage(
      `description cannot exceed ${PLAN_LIMITS.DESCRIPTION_MAX} characters`
    ),
  body('priceMonthly')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('priceMonthly must be a non-negative number')
    .toFloat(),
  body('priceYearly')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('priceYearly must be a non-negative number')
    .toFloat(),
  body('maxContacts')
    .optional()
    .isInt({ min: UNLIMITED })
    .withMessage('maxContacts must be -1 (unlimited) or a non-negative integer')
    .toInt(),
  body('maxCampaignsPerMonth')
    .optional()
    .isInt({ min: UNLIMITED })
    .withMessage(
      'maxCampaignsPerMonth must be -1 (unlimited) or a non-negative integer'
    )
    .toInt(),
  body('maxMessagesPerMonth')
    .optional()
    .isInt({ min: UNLIMITED })
    .withMessage(
      'maxMessagesPerMonth must be -1 (unlimited) or a non-negative integer'
    )
    .toInt(),
  body('features')
    .optional()
    .isArray({ max: PLAN_LIMITS.MAX_FEATURES })
    .withMessage(`features must be an array of at most ${PLAN_LIMITS.MAX_FEATURES}`),
  body('features.*')
    .optional()
    .isString()
    .trim()
    .isLength({ max: PLAN_LIMITS.FEATURE_MAX })
    .withMessage(`each feature cannot exceed ${PLAN_LIMITS.FEATURE_MAX} characters`),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
    .toBoolean(),
];

export { planIdParam, createPlan, updatePlan };
