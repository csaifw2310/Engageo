/**
 * Shared constants for the WhatsApp Webhook & Tracking module.
 *
 * This module is the inbound counterpart to the Messaging module: where
 * Messaging pushes a message out and stamps it SENT (holding Meta's
 * waMessageId), this module receives the asynchronous delivery callbacks from
 * the Meta WhatsApp Cloud API and advances each message through
 * DELIVERED → READ (or FAILED), then rolls the result up into the owning
 * campaign's counters.
 *
 * Design notes that the rest of the module relies on:
 *
 *   • The internal status vocabulary (MESSAGE_STATUS) is NOT redefined here —
 *     it is imported from the Messaging module so the whole app speaks one
 *     status enum. This module only owns the *inbound mapping* (Meta's
 *     lowercase event strings → our enum) and the *transition rules* below.
 *
 *   • Idempotency is enforced structurally, not by guessing. Meta delivers
 *     callbacks at-least-once and frequently out of order (a READ can arrive
 *     before its DELIVERED, and any event can be re-sent). WEBHOOK_STATUS_TRANSITIONS
 *     declares, for each target status, the only statuses a message may advance
 *     FROM. The service turns that into an atomic conditional update, so a
 *     duplicate or out-of-order event simply matches nothing and is a no-op —
 *     counters can never be incremented twice for the same transition.
 */

import { MESSAGE_STATUS } from '../message/message.constants.js';

// ── Meta event status strings ─────────────────────────────────────────────────
// The exact lowercase values Meta puts in `value.statuses[].status`.
export const WEBHOOK_EVENT_STATUS = Object.freeze({
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
});

// ── Meta status → internal MESSAGE_STATUS ─────────────────────────────────────
// The single mapping point between Meta's wire vocabulary and our enum. Any
// status not present here is treated as unknown and ignored (forward-compatible
// with new Meta event types).
export const WEBHOOK_STATUS_MAP = Object.freeze({
  [WEBHOOK_EVENT_STATUS.SENT]: MESSAGE_STATUS.SENT,
  [WEBHOOK_EVENT_STATUS.DELIVERED]: MESSAGE_STATUS.DELIVERED,
  [WEBHOOK_EVENT_STATUS.READ]: MESSAGE_STATUS.READ,
  [WEBHOOK_EVENT_STATUS.FAILED]: MESSAGE_STATUS.FAILED,
});

// ── Forward-only transition rules (the idempotency core) ──────────────────────
// For each target internal status, the set of statuses a message is allowed to
// advance FROM. A status update is applied ONLY if the message's current status
// is in this set; otherwise the event is a duplicate, out-of-order, or arrives
// after a terminal state, and is ignored.
//
//   SENT      ← PENDING / QUEUED                       (first confirmation)
//   DELIVERED ← PENDING / QUEUED / SENT                (never regress from READ)
//   READ      ← PENDING / QUEUED / SENT / DELIVERED    (terminal-success)
//   FAILED    ← PENDING / QUEUED / SENT                (never override a delivery)
//
// Consequences this buys us for free:
//   • duplicate DELIVERED → current already DELIVERED, not in DELIVERED's set → ignored
//   • DELIVERED arriving after READ → current READ, not in DELIVERED's set    → ignored
//   • anything arriving after FAILED → FAILED is in no set                    → ignored
export const WEBHOOK_STATUS_TRANSITIONS = Object.freeze({
  [MESSAGE_STATUS.SENT]: [MESSAGE_STATUS.PENDING, MESSAGE_STATUS.QUEUED],
  [MESSAGE_STATUS.DELIVERED]: [
    MESSAGE_STATUS.PENDING,
    MESSAGE_STATUS.QUEUED,
    MESSAGE_STATUS.SENT,
  ],
  [MESSAGE_STATUS.READ]: [
    MESSAGE_STATUS.PENDING,
    MESSAGE_STATUS.QUEUED,
    MESSAGE_STATUS.SENT,
    MESSAGE_STATUS.DELIVERED,
  ],
  [MESSAGE_STATUS.FAILED]: [
    MESSAGE_STATUS.PENDING,
    MESSAGE_STATUS.QUEUED,
    MESSAGE_STATUS.SENT,
  ],
});

// ── Timestamp field owned by each status ──────────────────────────────────────
// Which lifecycle timestamp this module stamps when a message reaches a status.
export const WEBHOOK_STATUS_TIMESTAMP = Object.freeze({
  [MESSAGE_STATUS.SENT]: 'sentAt',
  [MESSAGE_STATUS.DELIVERED]: 'deliveredAt',
  [MESSAGE_STATUS.READ]: 'readAt',
  [MESSAGE_STATUS.FAILED]: 'failedAt',
});

// ── Campaign-statistics support sets ──────────────────────────────────────────
// Counters are recomputed by COUNTING (never incremented), so they are
// inherently idempotent and out-of-order-safe.
//
// A READ message was also delivered, so it must keep counting towards
// totalDelivered — exactly mirroring how the Messaging module treats
// MESSAGE_SENT_STATUSES.
export const WEBHOOK_DELIVERED_STATUSES = Object.freeze([
  MESSAGE_STATUS.DELIVERED,
  MESSAGE_STATUS.READ,
]);

// "Still in flight" from the delivery point of view. A campaign is considered
// complete once NONE of its messages remain in these states (i.e. every message
// has reached DELIVERED / READ / FAILED).
export const WEBHOOK_IN_FLIGHT_STATUSES = Object.freeze([
  MESSAGE_STATUS.PENDING,
  MESSAGE_STATUS.QUEUED,
  MESSAGE_STATUS.SENT,
]);

// ── Verification ──────────────────────────────────────────────────────────────
// Meta sends `hub.mode=subscribe` on the GET verification handshake.
export const WEBHOOK_VERIFY_MODE = 'subscribe';

// Read lazily inside the service (not frozen here) so the token can be rotated
// via the environment without restarting reasoning about this constant.
export const getWebhookVerifyToken = () => process.env.WEBHOOK_VERIFY_TOKEN || '';

// ── Per-event processing outcomes ─────────────────────────────────────────────
export const WEBHOOK_RESULT = Object.freeze({
  PROCESSED: 'processed',
  IGNORED: 'ignored',
});

// ── Log / user-facing messages ────────────────────────────────────────────────
export const WEBHOOK_MESSAGES = Object.freeze({
  VERIFIED: 'Webhook verified successfully',
  VERIFICATION_FAILED: 'Webhook verification failed',
  EVENT_PROCESSED: 'Webhook event processed',
  EVENT_IGNORED: 'Webhook event ignored',

  RECEIVED: 'Webhook received',
  UNKNOWN_STATUS: 'Unknown Meta status — ignored',
  MESSAGE_NOT_FOUND: 'No message found for waMessageId — ignored',
});
