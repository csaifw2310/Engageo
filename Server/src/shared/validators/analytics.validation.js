import { param, query } from 'express-validator';
import {
  ANALYTICS_PAGINATION,
  ANALYTICS_SORT_VALUES,
  ANALYTICS_TREND_RANGE_VALUES,
} from '../../modules/analytics/analytics.constants.js';

/**
 * express-validator chains for the Analytics module. Each chain is an array
 * mounted BEFORE the shared `validate` middleware:
 *   router.get('/campaigns', listCampaigns, validate, controller.getCampaignAnalytics)
 *
 * `validate` converts any failures into the project's standard 422 JSON error
 * ({ success:false, message:'Validation failed', errors:[...] }) — analytics
 * never returns HTML on bad input.
 *
 * The wider project keeps its validators under src/shared/validators/. This
 * module's spec places the validation layer inside the module folder
 * (analytics.validation.js), which the Campaign validator already notes is an
 * accepted per-module convention — so the chains live here and are imported
 * directly by analytics.routes.js.
 */

// GET /api/analytics/campaigns  → pagination + sort
const listCampaigns = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be an integer >= 1')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: ANALYTICS_PAGINATION.MAX_LIMIT })
    .withMessage(`limit must be between 1 and ${ANALYTICS_PAGINATION.MAX_LIMIT}`)
    .toInt(),
  query('sort')
    .optional()
    .isIn(ANALYTICS_SORT_VALUES)
    .withMessage(`sort must be one of: ${ANALYTICS_SORT_VALUES.join(', ')}`),
];

// GET /api/analytics/campaigns/:campaignId
const campaignIdParam = [
  param('campaignId').isMongoId().withMessage('Invalid campaign id'),
];

// GET /api/analytics/trends  → range filter
const trends = [
  query('range')
    .optional()
    .isIn(ANALYTICS_TREND_RANGE_VALUES)
    .withMessage(
      `range must be one of: ${ANALYTICS_TREND_RANGE_VALUES.join(', ')}`
    ),
];

export { listCampaigns, campaignIdParam, trends };
