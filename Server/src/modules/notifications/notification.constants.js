/**
 * Shared constants for the Notification module.
 *
 * All enumerations, defaults, and user-facing messages live here so the
 * model, validator, service, and events layer all agree on the same source
 * of truth rather than duplicating literals across the module.
 */

// ── Notification categories ───────────────────────────────────────────────────
// Mirrors the frontend's `Notification['type']` union exactly so the API
// response never needs translation on the client.
export const NOTIFICATION_TYPE = Object.freeze({
  CAMPAIGN: 'campaign',
  BILLING: 'billing',
  WHATSAPP: 'whatsapp',
  CONTACT: 'contact',
  SYSTEM: 'system',
});

export const NOTIFICATION_TYPE_VALUES = Object.values(NOTIFICATION_TYPE);

// ── Notification priorities ───────────────────────────────────────────────────
export const NOTIFICATION_PRIORITY = Object.freeze({
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
});

export const NOTIFICATION_PRIORITY_VALUES = Object.values(NOTIFICATION_PRIORITY);

// ── Fine-grained business events ──────────────────────────────────────────────
// One entry per automatically-generated notification. Kept distinct from
// `type` (the broad category) so the frontend/analytics can filter precisely.
export const NOTIFICATION_EVENT = Object.freeze({
  CAMPAIGN_CREATED: 'campaign_created',
  CAMPAIGN_STARTED: 'campaign_started',
  CAMPAIGN_COMPLETED: 'campaign_completed',
  CAMPAIGN_FAILED: 'campaign_failed',

  WHATSAPP_CONNECTED: 'whatsapp_connected',
  WHATSAPP_DISCONNECTED: 'whatsapp_disconnected',

  CONTACT_IMPORT_COMPLETED: 'contact_import_completed',

  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',

  SUBSCRIPTION_ACTIVATED: 'subscription_activated',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  SUBSCRIPTION_EXPIRING: 'subscription_expiring',

  INCOMING_MESSAGE: 'incoming_message',

  SYSTEM_ALERT: 'system_alert',
});

export const NOTIFICATION_EVENT_VALUES = Object.values(NOTIFICATION_EVENT);

// ── Pagination defaults (mirrors CAMPAIGN_PAGINATION / BILLING_PAGINATION) ────
export const NOTIFICATION_PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
});

// ── User-facing messages ──────────────────────────────────────────────────────
export const NOTIFICATION_MESSAGES = Object.freeze({
  FETCHED: 'Notifications fetched successfully',
  UNREAD_COUNT_FETCHED: 'Unread count fetched successfully',
  MARKED_READ: 'Notification marked as read',
  ALL_MARKED_READ: 'All notifications marked as read',
  DELETED: 'Notification deleted successfully',
  NOT_FOUND: 'Notification not found',
});