/**
 * Shared constants for the Messaging module.
 *
 * The Messaging module is the only place that actually talks to the WhatsApp
 * Cloud API. Campaigns are merely definitions; this module reads a RUNNING
 * campaign, expands its groups into recipients, materialises one Message
 * document per recipient and then delivers them. The Webhook module will later
 * advance a delivered message through DELIVERED → READ (or FAILED).
 *
 * The status enum below is the single source of truth shared by this module,
 * the queue, the senders and the (future) Webhook module, so it lives here
 * rather than being inlined.
 *
 * Graph API config (base URL, pinned version, timeout) is intentionally NOT
 * redefined here — it is imported from the WhatsApp module so the whole app
 * speaks to one pinned Graph version from a single place.
 */

// ── Status ────────────────────────────────────────────────────────────────────
// PENDING  → record created by processCampaign(), not yet handed to the sender.
// QUEUED   → picked up by the queue, about to be dispatched.
// SENT     → accepted by Meta; we hold a waMessageId.
// DELIVERED→ webhook reported delivery to the handset (Webhook module owns this).
// READ     → webhook reported the recipient opened it (Webhook module owns this).
// FAILED   → a send attempt failed; retryable until MAX_RETRIES.
export const MESSAGE_STATUS = Object.freeze({
  PENDING: 'PENDING',
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
});

export const MESSAGE_STATUS_VALUES = Object.values(MESSAGE_STATUS);

// Statuses from which this module may attempt a (first) send. Anything already
// SENT/DELIVERED/READ is terminal for the sending path (prevents double-send);
// FAILED is retried only through the dedicated retry endpoint.
export const MESSAGE_SENDABLE_STATUSES = Object.freeze([
  MESSAGE_STATUS.PENDING,
  MESSAGE_STATUS.QUEUED,
]);

// Statuses that count as "successfully sent or beyond" when rolling up campaign
// counters. A message that has progressed to DELIVERED/READ was still sent, so
// it must keep counting towards totalSent.
export const MESSAGE_SENT_STATUSES = Object.freeze([
  MESSAGE_STATUS.SENT,
  MESSAGE_STATUS.DELIVERED,
  MESSAGE_STATUS.READ,
]);

// Statuses that mean "still in flight" — used to decide when a campaign's send
// pass is complete.
export const MESSAGE_PENDING_STATUSES = Object.freeze([
  MESSAGE_STATUS.PENDING,
  MESSAGE_STATUS.QUEUED,
]);

// ── Retry policy ──────────────────────────────────────────────────────────────
// A failed message may be retried at most this many times.
export const MAX_RETRIES = 3;

// ── Queue / dispatch tuning ───────────────────────────────────────────────────
// How many messages a campaign send pass dispatches in parallel. Bounding this
// protects the WhatsApp Cloud API rate limits and our own outbound sockets. The
// in-memory queue (message.queue.js) honours this; a real broker would too.
export const SEND_CONCURRENCY = Number(process.env.MESSAGE_SEND_CONCURRENCY) || 5;

// ── Mock mode ─────────────────────────────────────────────────────────────────
// Soft Meta dependency: when truthy, the module uses mock.sender.js instead of
// calling the Graph API. Lets the whole engine be developed and tested
// end-to-end without an approved WABA / template:
//   MESSAGE_MOCK_MODE=true npm start
export const MESSAGE_MOCK_MODE =
  String(process.env.MESSAGE_MOCK_MODE).toLowerCase() === 'true';

// ── Pagination defaults ───────────────────────────────────────────────────────
export const MESSAGE_PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
});

// ── Field limits ──────────────────────────────────────────────────────────────
export const MESSAGE_LIMITS = Object.freeze({
  SEARCH_MAX: 100,
});

// ── User-facing messages ──────────────────────────────────────────────────────
export const MESSAGE_MESSAGES = Object.freeze({
  PROCESSED: 'Campaign processed — message records generated',
  SENT: 'Message sent successfully',
  CAMPAIGN_SENT: 'Campaign send pass completed',
  RETRIED: 'Message retried successfully',
  LIST_FETCHED: 'Messages fetched successfully',
  FETCHED: 'Message fetched successfully',
  CAMPAIGN_MESSAGES_FETCHED: 'Campaign messages fetched successfully',

  NOT_FOUND: 'Message not found',
  CAMPAIGN_NOT_FOUND: 'Campaign not found',
  CONTACT_NOT_FOUND: 'Contact not found or does not belong to this account',
  TEMPLATE_NOT_FOUND: 'Template not found or does not belong to this account',
  CONNECTION_NOT_FOUND:
    'No WhatsApp connection found — connect a WhatsApp account before sending',
  CONNECTION_NOT_CONNECTED:
    'WhatsApp account is not currently connected — reconnect before sending',

  CAMPAIGN_NOT_RUNNING:
    'Campaign must be launched (RUNNING) before its messages can be processed or sent',
  NO_RECIPIENTS:
    'Campaign has no recipients — its target groups contain no contacts',
  NOTHING_TO_SEND: 'No pending messages to send for this campaign',

  ALREADY_SENT: 'Message has already been sent',
  NOT_FAILED: 'Only failed messages can be retried',
  MAX_RETRIES_EXCEEDED: `Message has reached the maximum of ${MAX_RETRIES} retries`,

  SEND_FAILED: 'Failed to send message via WhatsApp Cloud API',
});
