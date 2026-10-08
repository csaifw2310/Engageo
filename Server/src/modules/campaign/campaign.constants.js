/**
 * Shared constants for the Campaign module.
 *
 * A Campaign is a WhatsApp broadcast definition — it ties together one
 * WhatsApp connection, one approved Template and one or more Groups, and it
 * walks a strict lifecycle (DRAFT → SCHEDULED/RUNNING → COMPLETED/FAILED, or
 * CANCELLED). This module only manages that lifecycle; it never sends a single
 * message. The Messaging module will later pick up RUNNING campaigns, expand
 * their groups into contacts, send the template messages and write back the
 * delivery counters (totalSent / totalDelivered / totalRead / totalFailed).
 *
 * The status enum and the transition sets below are the single source of truth
 * for both this module and that future Messaging module, so they live here
 * rather than being inlined.
 */

// ── Status ────────────────────────────────────────────────────────────────────
export const CAMPAIGN_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  SCHEDULED: 'SCHEDULED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
});

export const CAMPAIGN_STATUS_VALUES = Object.values(CAMPAIGN_STATUS);

// ── Lifecycle transition rules ────────────────────────────────────────────────
// Which statuses each mutating action is permitted from. Centralised so the
// service, the validators and (later) the Messaging module all agree on the
// state machine instead of re-deriving it.
//
// A campaign may be:
//   • edited  → only while DRAFT or SCHEDULED (never once it has started)
//   • deleted → only while DRAFT or CANCELLED (nothing in-flight is removed)
//   • cancelled / scheduled / launched → only before it has started running
export const CAMPAIGN_UPDATABLE_STATUSES = Object.freeze([
  CAMPAIGN_STATUS.DRAFT,
  CAMPAIGN_STATUS.SCHEDULED,
]);

export const CAMPAIGN_DELETABLE_STATUSES = Object.freeze([
  CAMPAIGN_STATUS.DRAFT,
  CAMPAIGN_STATUS.CANCELLED,
]);

export const CAMPAIGN_CANCELLABLE_STATUSES = Object.freeze([
  CAMPAIGN_STATUS.DRAFT,
  CAMPAIGN_STATUS.SCHEDULED,
]);

export const CAMPAIGN_SCHEDULABLE_STATUSES = Object.freeze([
  CAMPAIGN_STATUS.DRAFT,
  CAMPAIGN_STATUS.SCHEDULED,
]);

export const CAMPAIGN_LAUNCHABLE_STATUSES = Object.freeze([
  CAMPAIGN_STATUS.DRAFT,
  CAMPAIGN_STATUS.SCHEDULED,
]);

// ── Pagination defaults ───────────────────────────────────────────────────────
export const CAMPAIGN_PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
});

// ── Field limits ──────────────────────────────────────────────────────────────
export const CAMPAIGN_LIMITS = Object.freeze({
  NAME_MAX: 150,
  DESCRIPTION_MAX: 1000,
  SEARCH_MAX: 100,
  MAX_GROUPS: 100,
});

// ── User-facing messages ──────────────────────────────────────────────────────
export const CAMPAIGN_MESSAGES = Object.freeze({
  CREATED: 'Campaign created successfully',
  LIST_FETCHED: 'Campaigns fetched successfully',
  FETCHED: 'Campaign fetched successfully',
  UPDATED: 'Campaign updated successfully',
  DELETED: 'Campaign deleted successfully',
  SCHEDULED: 'Campaign scheduled successfully',
  LAUNCHED: 'Campaign launched successfully',
  CANCELLED: 'Campaign cancelled successfully',

  NOT_FOUND: 'Campaign not found',
  DUPLICATE_NAME: 'A campaign with this name already exists',

  TEMPLATE_NOT_FOUND:
    'Template not found — it does not exist or does not belong to this account',
  GROUPS_NOT_FOUND:
    'One or more groups were not found or do not belong to this account',

  CONNECTION_NOT_FOUND:
    'No WhatsApp connection found — connect a WhatsApp account before creating a campaign',
  CONNECTION_NOT_CONNECTED:
    'WhatsApp account is not currently connected — reconnect before launching this campaign',

  NO_RECIPIENTS:
    'Campaign has no recipients — add at least one group containing contacts before launching',

  NOT_UPDATABLE:
    'Campaign can only be updated while in DRAFT or SCHEDULED status',
  NOT_DELETABLE:
    'Campaign can only be deleted while in DRAFT or CANCELLED status',
  NOT_CANCELLABLE:
    'Campaign can only be cancelled while in DRAFT or SCHEDULED status',
  NOT_SCHEDULABLE:
    'Campaign can only be scheduled while in DRAFT or SCHEDULED status',
  NOT_LAUNCHABLE:
    'Campaign can only be launched while in DRAFT or SCHEDULED status',

  SCHEDULE_IN_PAST: 'Scheduled time must be a future datetime',
});
