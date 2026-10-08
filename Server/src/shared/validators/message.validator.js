import { param, query } from 'express-validator';
import {
  MESSAGE_STATUS_VALUES,
  MESSAGE_PAGINATION,
  MESSAGE_LIMITS,
} from '../../modules/message/message.constants.js';

/**
 * express-validator chains for the Messaging module. Each chain is an array
 * mounted BEFORE the shared `validate` middleware:
 *   router.post('/send/:messageId', messageIdParam, validate, controller.sendMessage)
 *
 * Validators live here (src/shared/validators) to match the rest of the
 * project — the same place campaign/template/contact validators live — even
 * though the module spec drew them inside the module folder.
 */

// Reusable param checks.
const campaignIdParam = [
  param('campaignId').isMongoId().withMessage('Invalid campaign id'),
];

const messageIdParam = [
  param('messageId').isMongoId().withMessage('Invalid message id'),
];

const idParam = [param('id').isMongoId().withMessage('Invalid message id')];

// Shared list query: pagination + status filter + search.
const listQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be an integer >= 1')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: MESSAGE_PAGINATION.MAX_LIMIT })
    .withMessage(`limit must be between 1 and ${MESSAGE_PAGINATION.MAX_LIMIT}`)
    .toInt(),
  query('status')
    .optional()
    .isIn(MESSAGE_STATUS_VALUES)
    .withMessage(`status must be one of: ${MESSAGE_STATUS_VALUES.join(', ')}`),
  query('search')
    .optional()
    .trim()
    .isLength({ max: MESSAGE_LIMITS.SEARCH_MAX })
    .withMessage(`search cannot exceed ${MESSAGE_LIMITS.SEARCH_MAX} characters`),
];

// GET /api/messages — list query, plus optional campaignId filter.
const listMessages = [
  ...listQuery,
  query('campaignId')
    .optional()
    .isMongoId()
    .withMessage('campaignId must be a valid id'),
];

// GET /api/messages/campaign/:campaignId — campaign param + list query.
const campaignMessages = [...campaignIdParam, ...listQuery];

export {
  campaignIdParam,
  messageIdParam,
  idParam,
  listMessages,
  campaignMessages,
};
