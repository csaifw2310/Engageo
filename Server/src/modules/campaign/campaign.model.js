import mongoose from 'mongoose';
import {
  CAMPAIGN_STATUS,
  CAMPAIGN_STATUS_VALUES,
  CAMPAIGN_LIMITS,
} from './campaign.constants.js';

/**
 * Campaign
 *
 * A WhatsApp broadcast definition owned by a single tenant. It references the
 * tenant's WhatsApp connection, exactly one Template and one or more Groups,
 * and tracks lifecycle state plus aggregate delivery counters.
 *
 * This document is purely a definition + state holder. No sending logic lives
 * here or in this module's service — the Messaging module reads RUNNING
 * campaigns, performs the actual delivery, and writes back the totals* fields
 * and completedAt.
 *
 * Tenant isolation is enforced two ways:
 *   1. Every service query filters on `userId`.
 *   2. The unique compound index { userId, name } means a campaign name is
 *      unique PER tenant — two tenants may independently use the same name.
 */
const campaignSchema = new mongoose.Schema(
  {
    // Tenant owner.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // The WhatsApp connection this broadcast will be sent through. Resolved
    // from the tenant's single connection at create time (one connection per
    // tenant), so it is never accepted from the client.
    whatsappConnectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WhatsAppConnection',
      required: true,
    },

    // The approved template whose content will be broadcast.
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Template',
      required: true,
    },

    // One or more target groups. Recipients are derived from these groups'
    // memberships at launch time by the Messaging module.
    groupIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'A campaign must target at least one group',
      },
    },

    name: {
      type: String,
      required: [true, 'Campaign name is required'],
      trim: true,
      maxlength: [
        CAMPAIGN_LIMITS.NAME_MAX,
        `Campaign name cannot exceed ${CAMPAIGN_LIMITS.NAME_MAX} characters`,
      ],
    },

    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [
        CAMPAIGN_LIMITS.DESCRIPTION_MAX,
        `Description cannot exceed ${CAMPAIGN_LIMITS.DESCRIPTION_MAX} characters`,
      ],
    },

    // When the campaign is due to run. Null while a plain DRAFT; set once the
    // campaign is scheduled (or supplied at create time for convenience).
    scheduledAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: CAMPAIGN_STATUS_VALUES,
      default: CAMPAIGN_STATUS.DRAFT,
    },

    // ── Aggregate delivery counters ──────────────────────────────────────────
    // Owned by the Messaging module. `totalRecipients` is computed by this
    // module (a snapshot of the unique contacts across the target groups); the
    // remaining counters stay at 0 until the Messaging module starts sending.
    totalRecipients: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalSent: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalDelivered: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalRead: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalFailed: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Stamped when the campaign transitions into RUNNING.
    launchedAt: {
      type: Date,
      default: null,
    },

    // Stamped by the Messaging module when delivery finishes.
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Per-tenant name uniqueness (business rule: no duplicate campaign names per
// user). Drives the 409 handling in the service.
campaignSchema.index({ userId: 1, name: 1 }, { unique: true });

// Tenant-scoped list/filter support (the GET /api/campaigns query path):
//   • base tenant scope + newest-first listing
//   • status filter within a tenant
//   • upcoming-schedule lookups within a tenant
campaignSchema.index({ userId: 1, createdAt: -1 });
campaignSchema.index({ userId: 1, status: 1 });
campaignSchema.index({ userId: 1, scheduledAt: 1 });

// Cross-tenant sweep index for the scheduler: "all SCHEDULED campaigns whose
// scheduledAt is now due" (see campaign.scheduler.js). Also covers the standalone
// status / scheduledAt lookups called out in the spec.
campaignSchema.index({ status: 1, scheduledAt: 1 });

export default mongoose.model('Campaign', campaignSchema);
