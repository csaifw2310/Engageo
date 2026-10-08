import mongoose from "mongoose";
import {
  TEMPLATE_CATEGORY_VALUES,
  TEMPLATE_STATUS_VALUES,
  TEMPLATE_HEADER_TYPE,
  TEMPLATE_HEADER_TYPE_VALUES,
} from "./template.constants.js";

/**
 * Template
 *
 * A local cache of a single Meta-approved WhatsApp message template, owned by a
 * tenant. Templates are never authored here — they are pulled from Meta via
 * POST /api/templates/sync and refreshed on every subsequent sync. The Campaign
 * module will later reference a template by its `_id`.
 *
 * Tenant isolation is enforced two ways:
 *   1. Every service query filters on `userId`.
 *   2. The unique compound index { userId, metaTemplateId } below means a Meta
 *      template id can exist at most once PER tenant — so an upsert sync can
 *      never create duplicates, and two tenants can independently hold the same
 *      Meta template id without colliding.
 */

// Button sub-document. Shape matches the spec ({ type, text, url }); kept lean
// and id-less since buttons are always replaced wholesale on sync, never edited
// individually. `type` is not hard-enumed so a new Meta button type can't fail
// an otherwise-valid sync.
const buttonSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true,
    },
    text: {
      type: String,
      trim: true,
      default: "",
    },
    // Only present for URL buttons.
    url: {
      type: String,
      trim: true,
      default: null,
    },
    // Only present for PHONE_NUMBER buttons.
    phoneNumber: {
      type: String,
      trim: true,
      default: null,
    },
    // Only present for COPY_CODE buttons (Authentication templates only).
    copyCode: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { _id: false },
);

const templateSchema = new mongoose.Schema(
  {
    // Tenant owner.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // The connection this template was synced through. Recorded so we always
    // know which WABA a cached template came from.
    whatsappConnectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WhatsAppConnection",
      required: true,
    },

    // Meta's template id — the natural key used for upsert/dedup on sync.
    metaTemplateId: {
      type: String,
      required: true,
      trim: true,
    },

    name: {
      type: String,
      required: [true, "Template name is required"],
      trim: true,
      maxlength: [512, "Template name is too long"],
    },

    category: {
      type: String,
      enum: TEMPLATE_CATEGORY_VALUES,
      required: true,
    },

    // Meta language/locale tag, e.g. "en_US", "pt_BR".
    language: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: TEMPLATE_STATUS_VALUES,
      required: true,
    },

    headerType: {
      type: String,
      enum: TEMPLATE_HEADER_TYPE_VALUES,
      default: TEMPLATE_HEADER_TYPE.NONE,
    },

    // Only populated when headerType === 'TEXT'. IMAGE/VIDEO/DOCUMENT headers
    // have no local media storage — the sample is uploaded straight to Meta's
    // Resumable Upload API (see template.upload.js) and only the returned
    // handle is kept here, for reference and possible resubmission.
    headerText: {
      type: String,
      trim: true,
      default: "",
    },

    // Meta media handle returned by the header-media upload endpoint. Only
    // populated when headerType is IMAGE/VIDEO/DOCUMENT. Handles are
    // short-lived on Meta's side, so this is kept for audit/reference rather
    // than assumed reusable indefinitely.
    // Meta media handle returned by the header-media upload endpoint.
    // Only populated when headerType is IMAGE/VIDEO/DOCUMENT.
    // This is Meta-specific and should not be treated as persistent storage.
    headerMediaHandle: {
      type: String,
      trim: true,
      default: null,
    },

    // Persistent application-side media asset.
    // Used for dashboard preview, reuse, and campaign media delivery.
    headerMediaUrl: {
      type: String,
      trim: true,
      default: null,
    },

    headerMediaPublicId: {
      type: String,
      trim: true,
      default: null,
    },

    bodyText: {
      type: String,
      default: "",
    },

    // Keyed by variable index as a string, e.g. { "1": "John", "2": "Order #12345" }.
    // Drives the create wizard's live phone preview and is carried through so a
    // later edit/resubmit doesn't lose the examples the author already typed.
    exampleValues: {
      type: Map,
      of: String,
      default: {},
    },

    footerText: {
      type: String,
      default: "",
    },

    buttons: {
      type: [buttonSchema],
      default: [],
    },

    // Populated from Meta on sync when status === 'REJECTED'. Cleared (set to
    // null) whenever a sync reports a non-rejected status, so a stale reason
    // never lingers after a template is fixed and re-approved.
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },

    // Stamp of the last sync that touched this document.
    syncedAt: {
      type: Date,
      default: null,
    },

    // ── Audit ──────────────────────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Primary uniqueness + dedup key: one Meta template id per tenant. Drives the
// upsert in syncTemplates() and makes duplicate syncs idempotent.
templateSchema.index({ userId: 1, metaTemplateId: 1 }, { unique: true });

// Tenant-scoped list/filter support (the GET /api/templates query path):
//   • base tenant scope + newest-first listing
//   • status filter, category filter
templateSchema.index({ userId: 1, createdAt: -1 });
templateSchema.index({ userId: 1, status: 1 });
templateSchema.index({ userId: 1, category: 1 });

// Standalone lookups required by the spec.
templateSchema.index({ metaTemplateId: 1 });
templateSchema.index({ status: 1 });
templateSchema.index({ category: 1 });

export default mongoose.model("Template", templateSchema);
