import { body } from "express-validator";

import {
  VALIDATION,
  SUPPORTED_TIMEZONES,
} from "../../modules/settings/settings.constants.js";

/**
 * express-validator chains for the Settings module.
 *
 * Every chain is mounted before the shared `validate` middleware on its route.
 * All fields are `.optional()` to support partial PATCH semantics — the
 * absence of a field is not an error; only a malformed value is.
 */

// ── Full settings PATCH (/api/settings) ───────────────────────────────────────
const updateSettings = [
  body("profile.fullName")
    .optional()
    .isString()
    .trim()
    .isLength({ max: VALIDATION.FULL_NAME_MAX })
    .withMessage(
      `fullName must not exceed ${VALIDATION.FULL_NAME_MAX} characters`,
    ),

  body("profile.phoneNumber")
    .optional()
    .isString()
    .trim()
    .matches(VALIDATION.PHONE_REGEX)
    .withMessage(
      "phoneNumber must be a valid international phone number (e.g. +919876543210)",
    ),

  body("profile.avatarUrl")
    .optional()
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("avatarUrl must be a valid HTTP/HTTPS URL")
    .isLength({ max: VALIDATION.AVATAR_URL_MAX })
    .withMessage(
      `avatarUrl must not exceed ${VALIDATION.AVATAR_URL_MAX} characters`,
    ),

  body("business.businessName")
    .optional()
    .isString()
    .trim()
    .isLength({ max: VALIDATION.BUSINESS_NAME_MAX })
    .withMessage(
      `businessName must not exceed ${VALIDATION.BUSINESS_NAME_MAX} characters`,
    ),

  body("business.website")
    .optional()
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("website must be a valid HTTP/HTTPS URL")
    .isLength({ max: VALIDATION.WEBSITE_MAX })
    .withMessage(
      `website must not exceed ${VALIDATION.WEBSITE_MAX} characters`,
    ),

  body("business.industry")
    .optional()
    .isString()
    .trim()
    .isLength({ max: VALIDATION.INDUSTRY_MAX })
    .withMessage(
      `industry must not exceed ${VALIDATION.INDUSTRY_MAX} characters`,
    ),

  body("business.address")
    .optional()
    .isString()
    .trim()
    .isLength({ max: VALIDATION.ADDRESS_MAX })
    .withMessage(
      `address must not exceed ${VALIDATION.ADDRESS_MAX} characters`,
    ),

  body("notifications.emailNotifications")
    .optional()
    .isBoolean()
    .withMessage("emailNotifications must be a boolean")
    .toBoolean(),

  body("notifications.incomingMessages")
    .optional()
    .isBoolean()
    .withMessage("incomingMessages must be a boolean")
    .toBoolean(),

  body("notifications.campaignCompleted")
    .optional()
    .isBoolean()
    .withMessage("campaignCompleted must be a boolean")
    .toBoolean(),

  body("notifications.campaignFailed")
    .optional()
    .isBoolean()
    .withMessage("campaignFailed must be a boolean")
    .toBoolean(),

  body("notifications.paymentAlerts")
    .optional()
    .isBoolean()
    .withMessage("paymentAlerts must be a boolean")
    .toBoolean(),

  body("notifications.subscriptionAlerts")
    .optional()
    .isBoolean()
    .withMessage("subscriptionAlerts must be a boolean")
    .toBoolean(),

  body("preferences.timezone")
    .optional()
    .isString()
    .isIn(SUPPORTED_TIMEZONES)
    .withMessage(
      "timezone must be a supported IANA timezone string. Examples: Asia/Kolkata, America/New_York, Europe/London",
    ),
];

// ── Profile PATCH (/api/settings/profile) ────────────────────────────────────
const updateProfile = [
  body("fullName")
    .optional()
    .isString()
    .trim()
    .isLength({ max: VALIDATION.FULL_NAME_MAX })
    .withMessage(
      `fullName must not exceed ${VALIDATION.FULL_NAME_MAX} characters`,
    ),

  body("phoneNumber")
    .optional()
    .isString()
    .trim()
    .matches(VALIDATION.PHONE_REGEX)
    // Generic example — never put a real user's number here
    .withMessage(
      "phoneNumber must be a valid international phone number (e.g. +919876543210)",
    ),

  body("avatarUrl")
    .optional()
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("avatarUrl must be a valid HTTP/HTTPS URL")
    .isLength({ max: VALIDATION.AVATAR_URL_MAX })
    .withMessage(
      `avatarUrl must not exceed ${VALIDATION.AVATAR_URL_MAX} characters`,
    ),
];

// ── Business PATCH (/api/settings/business) ───────────────────────────────────
const updateBusiness = [
  body("businessName")
    .optional()
    .isString()
    .trim()
    .isLength({ max: VALIDATION.BUSINESS_NAME_MAX })
    .withMessage(
      `businessName must not exceed ${VALIDATION.BUSINESS_NAME_MAX} characters`,
    ),

  body("website")
    .optional()
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("website must be a valid HTTP/HTTPS URL")
    .isLength({ max: VALIDATION.WEBSITE_MAX })
    .withMessage(
      `website must not exceed ${VALIDATION.WEBSITE_MAX} characters`,
    ),

  body("industry")
    .optional()
    .isString()
    .trim()
    .isLength({ max: VALIDATION.INDUSTRY_MAX })
    .withMessage(
      `industry must not exceed ${VALIDATION.INDUSTRY_MAX} characters`,
    ),

  body("address")
    .optional()
    .isString()
    .trim()
    .isLength({ max: VALIDATION.ADDRESS_MAX })
    .withMessage(
      `address must not exceed ${VALIDATION.ADDRESS_MAX} characters`,
    ),
];

// ── Notifications PATCH (/api/settings/notifications) ─────────────────────────
const updateNotifications = [
  body("emailNotifications")
    .optional()
    .isBoolean()
    .withMessage("emailNotifications must be a boolean")
    .toBoolean(),

  body("incomingMessages")
    .optional()
    .isBoolean()
    .withMessage("incomingMessages must be a boolean")
    .toBoolean(),

  body("campaignCompleted")
    .optional()
    .isBoolean()
    .withMessage("campaignCompleted must be a boolean")
    .toBoolean(),

  body("campaignFailed")
    .optional()
    .isBoolean()
    .withMessage("campaignFailed must be a boolean")
    .toBoolean(),

  body("paymentAlerts")
    .optional()
    .isBoolean()
    .withMessage("paymentAlerts must be a boolean")
    .toBoolean(),

  body("subscriptionAlerts")
    .optional()
    .isBoolean()
    .withMessage("subscriptionAlerts must be a boolean")
    .toBoolean(),
];

// ── Preferences PATCH (/api/settings/preferences) ─────────────────────────────
const updatePreferences = [
  body("timezone")
    .optional()
    .isString()
    .isIn(SUPPORTED_TIMEZONES)
    .withMessage(
      "timezone must be a supported IANA timezone string. Examples: Asia/Kolkata, America/New_York, Europe/London",
    ),
  body("theme")
    .optional()
    .isIn(["dark", "light"])
    .withMessage("theme must be dark or light"),
];

export {
  updateSettings,
  updateProfile,
  updateBusiness,
  updateNotifications,
  updatePreferences,
};
