import { body, param, query } from 'express-validator';

const createGroup = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Group name is required')
    .isLength({ max: 120 })
    .withMessage('Group name cannot exceed 120 characters'),
  body('description').optional().trim().isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
];

const updateGroup = [
  param('id').isMongoId().withMessage('Invalid group id'),
  body('name').optional().trim().notEmpty().isLength({ max: 120 }),
  body('description').optional().trim().isLength({ max: 500 }),
];

const groupIdParam = [param('id').isMongoId().withMessage('Invalid group id')];

const membershipParams = [
  param('groupId').isMongoId().withMessage('Invalid group id'),
  param('contactId').isMongoId().withMessage('Invalid contact id'),
];

// Shared shape for the bulk membership endpoints: either an explicit list of
// contact ids, or `all: true` to act on everything matching `search`.
const bulkMembers = [
  param('id').isMongoId().withMessage('Invalid group id'),
  body('all').optional().isBoolean().toBoolean(),
  body('search').optional().trim().isLength({ max: 100 }),
  body('contactIds')
    .optional()
    .isArray({ max: 10000 })
    .withMessage('contactIds must be an array of at most 10000 ids'),
  body('contactIds.*').optional().isMongoId().withMessage('Invalid contact id'),
  body().custom((value) => {
    if (value?.all === true) return true;
    if (Array.isArray(value?.contactIds) && value.contactIds.length > 0) return true;
    throw new Error('Provide contactIds, or set all: true');
  }),
];

const groupContactsQuery = [
  param('id').isMongoId().withMessage('Invalid group id'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().trim().isLength({ max: 100 }),
];

const listGroups = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().trim().isLength({ max: 100 }),
];

export {
  createGroup,
  updateGroup,
  groupIdParam,
  membershipParams,
  bulkMembers,
  groupContactsQuery,
  listGroups,
};