/**
 * Shared constants for the User Settings module.
 *
 * All default values, validation limits, supported enumerations, and
 * user-facing messages live here so every layer (model, validation, service,
 * repository) can import from a single source of truth rather than duplicating
 * literals across the module.
 */

// ── Default notification preferences ─────────────────────────────────────────
// Applied when auto-creating a settings document on first access.
export const DEFAULT_NOTIFICATIONS = Object.freeze({
  emailNotifications: true,
  incomingMessages: true,
  campaignCompleted: true,
  campaignFailed: true,
  paymentAlerts: true,
  subscriptionAlerts: true,
});

// ── Default timezone ──────────────────────────────────────────────────────────
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

// ── Validation limits ─────────────────────────────────────────────────────────
export const VALIDATION = Object.freeze({
  FULL_NAME_MAX: 100,
  PHONE_MAX: 20,
  BUSINESS_NAME_MAX: 150,
  WEBSITE_MAX: 250,
  INDUSTRY_MAX: 100,
  ADDRESS_MAX: 300,
  AVATAR_URL_MAX: 500,
  // International phone: optional leading +, 7–15 digits (E.164-ish).
  PHONE_REGEX: /^\+?[1-9]\d{6,14}$/,
});

// ── Supported IANA timezones ───────────────────────────────────────────────────
// A representative allow-list of IANA timezone identifiers. Extend freely;
// the list is checked at validation time so only known-good strings reach the DB.
export const SUPPORTED_TIMEZONES = Object.freeze([
  'Africa/Abidjan',
  'Africa/Accra',
  'Africa/Addis_Ababa',
  'Africa/Algiers',
  'Africa/Cairo',
  'Africa/Casablanca',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Nairobi',
  'America/Anchorage',
  'America/Argentina/Buenos_Aires',
  'America/Bogota',
  'America/Chicago',
  'America/Denver',
  'America/Halifax',
  'America/Lima',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/New_York',
  'America/Phoenix',
  'America/Sao_Paulo',
  'America/Toronto',
  'America/Vancouver',
  'Asia/Almaty',
  'Asia/Bangkok',
  'Asia/Colombo',
  'Asia/Dhaka',
  'Asia/Dubai',
  'Asia/Hong_Kong',
  'Asia/Jakarta',
  'Asia/Karachi',
  'Asia/Kathmandu',
  'Asia/Kolkata',
  'Asia/Kuala_Lumpur',
  'Asia/Manila',
  'Asia/Riyadh',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Taipei',
  'Asia/Tehran',
  'Asia/Tokyo',
  'Asia/Tashkent',
  'Atlantic/Azores',
  'Australia/Adelaide',
  'Australia/Brisbane',
  'Australia/Melbourne',
  'Australia/Perth',
  'Australia/Sydney',
  'Europe/Amsterdam',
  'Europe/Athens',
  'Europe/Belgrade',
  'Europe/Berlin',
  'Europe/Brussels',
  'Europe/Bucharest',
  'Europe/Budapest',
  'Europe/Copenhagen',
  'Europe/Dublin',
  'Europe/Helsinki',
  'Europe/Istanbul',
  'Europe/Kiev',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Moscow',
  'Europe/Oslo',
  'Europe/Paris',
  'Europe/Prague',
  'Europe/Rome',
  'Europe/Stockholm',
  'Europe/Vienna',
  'Europe/Warsaw',
  'Europe/Zurich',
  'Pacific/Auckland',
  'Pacific/Fiji',
  'Pacific/Honolulu',
  'Pacific/Noumea',
  'UTC',
]);

// ── User-facing messages ──────────────────────────────────────────────────────
export const SETTINGS_MESSAGES = Object.freeze({
  FETCHED: 'Settings fetched successfully',
  UPDATED: 'Settings updated successfully',

  PROFILE_FETCHED: 'Profile fetched successfully',
  PROFILE_UPDATED: 'Profile updated successfully',

  BUSINESS_FETCHED: 'Business information fetched successfully',
  BUSINESS_UPDATED: 'Business information updated successfully',

  NOTIFICATIONS_FETCHED: 'Notification preferences fetched successfully',
  NOTIFICATIONS_UPDATED: 'Notification preferences updated successfully',

  PREFERENCES_FETCHED: 'Preferences fetched successfully',
  PREFERENCES_UPDATED: 'Preferences updated successfully',
});
