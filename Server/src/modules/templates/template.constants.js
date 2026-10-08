/**
 * Shared constants for the Template Management module.
 *
 * Templates mirror Meta's "Message Template" objects, so the enum values here
 * (category, status, header format) deliberately match the strings Meta returns
 * on the Graph API verbatim — that keeps the sync a straight copy with no value
 * translation. The Campaign module will later import these same enums when it
 * references a template, so they live here rather than being inlined.
 *
 * Graph API config (base URL, version, timeout) is intentionally NOT redefined
 * here — it is imported from the WhatsApp module so the whole app speaks to one
 * pinned Graph version from a single place.
 */

// ── Category ──────────────────────────────────────────────────────────────────
// Matches Meta's template categories exactly.
export const TEMPLATE_CATEGORY = Object.freeze({
  MARKETING: 'MARKETING',
  UTILITY: 'UTILITY',
  AUTHENTICATION: 'AUTHENTICATION',
});

export const TEMPLATE_CATEGORY_VALUES = Object.values(TEMPLATE_CATEGORY);

// ── Status ────────────────────────────────────────────────────────────────────
// Review/lifecycle state as reported by Meta.
export const TEMPLATE_STATUS = Object.freeze({
  APPROVED: 'APPROVED',
  PENDING: 'PENDING',
  REJECTED: 'REJECTED',
  PAUSED: 'PAUSED',
});

export const TEMPLATE_STATUS_VALUES = Object.values(TEMPLATE_STATUS);

// ── Header type ───────────────────────────────────────────────────────────────
// Derived from the HEADER component's `format` (or NONE when absent).
export const TEMPLATE_HEADER_TYPE = Object.freeze({
  NONE: 'NONE',
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  DOCUMENT: 'DOCUMENT',
});

export const TEMPLATE_HEADER_TYPE_VALUES = Object.values(TEMPLATE_HEADER_TYPE);

// ── Button type ───────────────────────────────────────────────────────────────
// Kept permissive (not enforced as a hard enum on the sub-schema) so new Meta
// button types don't break a sync, but listed here for reference/validation use.
export const TEMPLATE_BUTTON_TYPE = Object.freeze({
  QUICK_REPLY: 'QUICK_REPLY',
  URL: 'URL',
  PHONE_NUMBER: 'PHONE_NUMBER',
  COPY_CODE: 'COPY_CODE',
});

export const TEMPLATE_BUTTON_TYPE_VALUES = Object.values(TEMPLATE_BUTTON_TYPE);

// Meta's published per-type caps for message template buttons. Mirrors
// Client/src/types/template.ts#TEMPLATE_BUTTON_LIMITS verbatim so front and
// back end can never silently drift apart on what "too many buttons" means.
export const TEMPLATE_BUTTON_LIMITS = Object.freeze({
  MAX_TOTAL: 10,
  MAX_URL: 2,
  MAX_PHONE_NUMBER: 1,
  MAX_COPY_CODE: 1,
});

// ── Header media (IMAGE/VIDEO/DOCUMENT samples) ──────────────────────────────
// Mirrors Client/src/components/templates/create/StepHeader.tsx's MEDIA_ACCEPT
// / MEDIA_LIMITATION exactly, so a file the wizard lets the user pick can never
// be rejected here for a type/size reason the UI didn't already warn about.
export const TEMPLATE_HEADER_MEDIA_MIME_TYPES = Object.freeze({
  IMAGE: ['image/jpeg', 'image/png'],
  VIDEO: ['video/mp4', 'video/3gpp'],
  DOCUMENT: ['application/pdf'],
});

export const TEMPLATE_HEADER_MEDIA_MAX_BYTES = Object.freeze({
  IMAGE: 5 * 1024 * 1024, // 5MB
  VIDEO: 16 * 1024 * 1024, // 16MB
  DOCUMENT: 100 * 1024 * 1024, // 100MB
});

// Names in this module a route it can bind to.
export const TEMPLATE_UPLOADABLE_HEADER_TYPES = ['IMAGE', 'VIDEO', 'DOCUMENT'];

// ── Name format ───────────────────────────────────────────────────────────────
// Meta template names: lowercase letters, digits, underscores only — no spaces,
// no uppercase. Enforced on create so a name can never be rejected by Meta for
// a format reason the API could have caught up front.
export const TEMPLATE_NAME_REGEX = /^[a-z0-9_]+$/;
export const TEMPLATE_NAME_MAX_LENGTH = 512;

// ── Character limits ─────────────────────────────────────────────────────────
// Meta's published length caps per component. Header text and footer share the
// same 60-char cap; body is the only long-form component.
export const TEMPLATE_CHAR_LIMITS = Object.freeze({
  HEADER_TEXT: 60,
  BODY_TEXT: 1024,
  FOOTER_TEXT: 60,
  BUTTON_TEXT: 25,
});

// ── Variable parser ───────────────────────────────────────────────────────────
// Matches Client/src/types/template.ts#detectTemplateVariables so the same
// {{1}}, {{2}}, ... tokens are recognized identically on both sides. {{0}} is
// intentionally NOT matched by \d+ requiring at least one digit and index >= 1
// is enforced separately in the parser (Meta variables are 1-indexed).
export const TEMPLATE_VARIABLE_PATTERN = /\{\{\s*(\d+)\s*\}\}/g;

// ── Pagination defaults ───────────────────────────────────────────────────────
export const TEMPLATE_PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
});

// ── Sync config ───────────────────────────────────────────────────────────────
// Page size requested from Meta's /message_templates endpoint per call.
export const META_TEMPLATES_PAGE_SIZE = 100;

// Soft Meta dependency: when truthy, syncTemplates() uses an in-memory mock data
// set instead of calling the Graph API. Lets the module be developed and tested
// end-to-end without a live WABA / approved templates.
//   TEMPLATE_SYNC_MOCK=true npm start
export const TEMPLATE_SYNC_MOCK =
  String(process.env.TEMPLATE_SYNC_MOCK).toLowerCase() === 'true';

// ── User-facing messages ──────────────────────────────────────────────────────
export const TEMPLATE_MESSAGES = Object.freeze({
  CREATED: 'Template created successfully',
  LIST_FETCHED: 'Templates fetched successfully',
  FETCHED: 'Template fetched successfully',
  SYNCED: 'Templates synced successfully',
  DELETED: 'Template deleted successfully',
  NOT_FOUND: 'Template not found',
  CONNECTION_NOT_FOUND:
    'No WhatsApp connection found — connect a WhatsApp account before syncing templates',
  CONNECTION_NOT_CONNECTED:
    'WhatsApp account is not currently connected — reconnect before syncing templates',
  SYNC_FAILED: 'Failed to sync templates from Meta',

  // ── Create-template validation ─────────────────────────────────────────────
  NAME_REQUIRED: 'Template name is required',
  NAME_INVALID_FORMAT:
    'Template name must be lowercase letters, numbers, and underscores only, with no spaces',
  NAME_TOO_LONG: `Template name cannot exceed ${TEMPLATE_NAME_MAX_LENGTH} characters`,
  CATEGORY_INVALID: `Category must be one of: ${TEMPLATE_CATEGORY_VALUES.join(', ')}`,
  LANGUAGE_REQUIRED: 'Language is required',

  HEADER_TYPE_INVALID: `Header type must be one of: ${TEMPLATE_HEADER_TYPE_VALUES.join(', ')}`,
  HEADER_TEXT_REQUIRED: 'Header text is required when the header type is TEXT',
  HEADER_TEXT_TOO_LONG: `Header text cannot exceed ${TEMPLATE_CHAR_LIMITS.HEADER_TEXT} characters`,
  HEADER_TEXT_NOT_ALLOWED: 'Header text is only allowed when the header type is TEXT',
  HEADER_MEDIA_SAMPLE_REQUIRED:
    'A sample file is required for IMAGE, VIDEO, and DOCUMENT headers',

  // ── Header media upload ─────────────────────────────────────────────────────
  MEDIA_FILE_REQUIRED: 'A file is required',
  MEDIA_HEADER_TYPE_REQUIRED:
    'headerType must be one of IMAGE, VIDEO, or DOCUMENT to upload header media',
  MEDIA_TYPE_INVALID: 'This file type is not accepted for the selected header type',
  MEDIA_TOO_LARGE: 'This file exceeds the maximum size allowed for this header type',
  MEDIA_UPLOAD_FAILED: 'Failed to upload header media to Meta',

  BODY_REQUIRED: 'Body text is required',
  BODY_TOO_LONG: `Body text cannot exceed ${TEMPLATE_CHAR_LIMITS.BODY_TEXT} characters`,

  FOOTER_TOO_LONG: `Footer text cannot exceed ${TEMPLATE_CHAR_LIMITS.FOOTER_TEXT} characters`,

  VARIABLE_INVALID_INDEX: 'Variables must be numbered starting at {{1}} — {{0}} is not valid',
  VARIABLE_NOT_SEQUENTIAL:
    'Variable numbering must be sequential with no gaps (e.g. {{1}}, {{2}}, {{3}})',
  VARIABLE_DUPLICATE: 'Duplicate variable indices are not allowed',

  BUTTONS_TOO_MANY: `A template can have at most ${TEMPLATE_BUTTON_LIMITS.MAX_TOTAL} buttons`,
  BUTTONS_TOO_MANY_URL: `A template can have at most ${TEMPLATE_BUTTON_LIMITS.MAX_URL} URL buttons`,
  BUTTONS_TOO_MANY_PHONE: `A template can have at most ${TEMPLATE_BUTTON_LIMITS.MAX_PHONE_NUMBER} phone number button`,
  BUTTONS_TOO_MANY_COPY_CODE: `A template can have at most ${TEMPLATE_BUTTON_LIMITS.MAX_COPY_CODE} copy code button`,
  BUTTON_TYPE_INVALID: `Button type must be one of: ${TEMPLATE_BUTTON_TYPE_VALUES.join(', ')}`,
  BUTTON_TEXT_REQUIRED: 'Button text is required',
  BUTTON_TEXT_TOO_LONG: `Button text cannot exceed ${TEMPLATE_CHAR_LIMITS.BUTTON_TEXT} characters`,
  BUTTON_URL_REQUIRED: 'A URL is required for URL buttons',
  BUTTON_PHONE_REQUIRED: 'A phone number is required for phone number buttons',
  BUTTON_COPY_CODE_REQUIRED: 'A copy code is required for copy code buttons',
  BUTTON_COPY_CODE_NOT_ALLOWED:
    'Copy code buttons are only allowed on AUTHENTICATION templates',
});
