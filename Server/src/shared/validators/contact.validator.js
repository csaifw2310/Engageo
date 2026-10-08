import { body, query, param } from 'express-validator';

// Permissive international phone format: optional +, digits, spaces, dashes, parens.
const PHONE_REGEX = /^\+?[0-9\-\s()]{7,20}$/;

const createContact = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 120 })
    .withMessage('Name cannot exceed 120 characters'),
  body('phoneNumber')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(PHONE_REGEX)
    .withMessage('Invalid phone number format'),
  body('email')
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  body('tags').optional().isArray().withMessage('tags must be an array'),
  body('tags.*').optional().isString().trim(),
  body('customFields')
    .optional()
    .isObject()
    .withMessage('customFields must be an object'),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('status must be "active" or "inactive"'),
];

const updateContact = [
  param('id').isMongoId().withMessage('Invalid contact id'),
  body('name').optional().trim().notEmpty().isLength({ max: 120 }),
  body('phoneNumber').optional().trim().notEmpty().matches(PHONE_REGEX)
    .withMessage('Invalid phone number format'),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail()
    .withMessage('Invalid email format'),
  body('tags').optional().isArray(),
  body('tags.*').optional().isString().trim(),
  body('customFields').optional().isObject(),
  body('status').optional().isIn(['active', 'inactive']),
];

const listContacts = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100').toInt(),
  query('search').optional().trim().isLength({ max: 100 }),
  query('status').optional().isIn(['active', 'inactive']),
  query('tag').optional().trim(),
  query('sort').optional().isIn(['createdAt', '-createdAt', 'name', '-name']),
];

const contactIdParam = [param('id').isMongoId().withMessage('Invalid contact id')];

export {
  createContact,
  updateContact,
  listContacts,
  contactIdParam,
};
