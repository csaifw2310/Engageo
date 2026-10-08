import { body } from 'express-validator';

/**
 * Validates the Embedded Signup payload before it reaches the controller.
 * Mount as: router.post('/connect', connect, validate, controller.connect)
 *
 * All five fields are opaque identifiers/credentials returned by Meta, so the
 * rules deliberately check presence, type and sane length rather than format —
 * the authoritative check is the /sync call against the Graph API.
 */
const connect = [
  body('businessAccountId')
    .trim()
    .notEmpty()
    .withMessage('Business account ID is required')
    .bail()
    .isString()
    .withMessage('Business account ID must be a string')
    .isLength({ max: 64 })
    .withMessage('Business account ID is too long'),

  body('phoneNumberId')
    .trim()
    .notEmpty()
    .withMessage('Phone number ID is required')
    .bail()
    .isString()
    .withMessage('Phone number ID must be a string')
    .isLength({ max: 64 })
    .withMessage('Phone number ID is too long'),

  body('phoneNumber')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .bail()
    .matches(/^\+?[0-9][0-9\s\-()]{5,20}$/)
    .withMessage('Phone number format is invalid'),

  body('businessName')
    .trim()
    .notEmpty()
    .withMessage('Business name is required')
    .bail()
    .isLength({ max: 200 })
    .withMessage('Business name cannot exceed 200 characters'),

  body('accessToken')
    .trim()
    .notEmpty()
    .withMessage('Access token is required')
    .bail()
    .isString()
    .withMessage('Access token must be a string')
    .isLength({ min: 20 })
    .withMessage('Access token looks invalid'),
];

export const exchangeCode = [
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Meta authorisation code is required')
    .isString()
    .withMessage('code must be a string'),
];

export { connect };
