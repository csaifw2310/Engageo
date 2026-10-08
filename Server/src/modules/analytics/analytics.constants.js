/**
 * Shared constants for the Analytics module.
 *
 * The Analytics module is strictly READ-ONLY. It owns no collection and stores
 * nothing of its own — every figure it returns is derived, on demand, from the
 * existing Campaign / Message / Contact / Group / Membership collections via
 * MongoDB aggregation. This keeps analytics always-consistent with the source
 * data and means there is no model, no migration and no counter to keep in sync.
 *
 * The status vocabulary is NOT redefined here. The funnel semantics
 * (what counts as "sent" vs "delivered") are imported from the Messaging module
 * so the whole app agrees on one definition, exactly like the Webhook module
 * does when it recomputes campaign counters:
 *
 *   • A message that reached DELIVERED or READ was still SENT, so it keeps
 *     counting towards totalSent  → MESSAGE_SENT_STATUSES (imported).
 *   • A message that reached READ was still DELIVERED, so it keeps counting
 *     towards totalDelivered      → ANALYTICS_DELIVERED_STATUSES (below).
 *
 * ANALYTICS_DELIVERED_STATUSES intentionally mirrors the Webhook module's
 * WEBHOOK_DELIVERED_STATUSES; it is re-declared here (rather than imported) only
 * to avoid a read-only reporting module taking a dependency on the inbound
 * webhook module. Both derive from the same MESSAGE_STATUS enum, so they cannot
 * drift apart in meaning.
 */

import {
  MESSAGE_STATUS,
  MESSAGE_SENT_STATUSES,
} from '../message/message.constants.js';

// ── Re-exported funnel sets (single source of truth = Messaging module) ───────
export { MESSAGE_STATUS, MESSAGE_SENT_STATUSES };

// A message counts as "delivered" once it is DELIVERED or beyond (READ implies
// delivered). Mirrors webhook.constants WEBHOOK_DELIVERED_STATUSES.
export const ANALYTICS_DELIVERED_STATUSES = Object.freeze([
  MESSAGE_STATUS.DELIVERED,
  MESSAGE_STATUS.READ,
]);

// ── Contact status values ─────────────────────────────────────────────────────
// The Contact model stores status as a lowercase enum ('active' | 'inactive').
// Centralised here so the contact-analytics aggregation never hard-codes the
// literals.
export const CONTACT_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

// ── Campaign-list pagination defaults ─────────────────────────────────────────
// Matches the Campaign / Message modules so paging behaves identically across
// the API surface.
export const ANALYTICS_PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
});

// ── Campaign-list sort options ────────────────────────────────────────────────
// newest / oldest          → by createdAt.
// best- / worst-performing → by computed readRate, then deliveryRate, then
//                            total reads (tie-breakers), so the ordering is
//                            stable and meaningful even when read rates match.
export const ANALYTICS_SORT = Object.freeze({
  NEWEST: 'newest',
  OLDEST: 'oldest',
  BEST_PERFORMING: 'best-performing',
  WORST_PERFORMING: 'worst-performing',
});

export const ANALYTICS_SORT_VALUES = Object.values(ANALYTICS_SORT);

export const ANALYTICS_DEFAULT_SORT = ANALYTICS_SORT.NEWEST;

// ── Trend ranges ──────────────────────────────────────────────────────────────
// Maps the accepted ?range value to a number of days (inclusive of today). Days
// are bucketed in UTC so results are deterministic regardless of server / client
// timezone.
export const ANALYTICS_TREND_RANGE = Object.freeze({
  '7d': 7,
  '30d': 30,
  '90d': 90,
});

export const ANALYTICS_TREND_RANGE_VALUES = Object.keys(ANALYTICS_TREND_RANGE);

export const ANALYTICS_DEFAULT_TREND_RANGE = '7d';

// Timezone used to bucket documents into calendar days for trend aggregation.
export const ANALYTICS_TREND_TIMEZONE = 'UTC';

// ── Top campaigns ─────────────────────────────────────────────────────────────
export const TOP_CAMPAIGNS_LIMIT = 10;

// ── User-facing messages ──────────────────────────────────────────────────────
export const ANALYTICS_MESSAGES = Object.freeze({
  DASHBOARD_FETCHED: 'Dashboard analytics fetched successfully',
  CAMPAIGNS_FETCHED: 'Campaign analytics fetched successfully',
  CAMPAIGN_FETCHED: 'Campaign analytics fetched successfully',
  MESSAGES_FETCHED: 'Message analytics fetched successfully',
  CONTACTS_FETCHED: 'Contact analytics fetched successfully',
  GROUPS_FETCHED: 'Group analytics fetched successfully',
  TRENDS_FETCHED: 'Campaign trends fetched successfully',
  TOP_CAMPAIGNS_FETCHED: 'Top campaigns fetched successfully',

  CAMPAIGN_NOT_FOUND:
    'Campaign not found — it does not exist or does not belong to this account',
});
