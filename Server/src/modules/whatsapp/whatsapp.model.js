import mongoose from "mongoose";
import {
  CONNECTION_STATUS,
  CONNECTION_STATUS_VALUES,
} from "./whatsapp.constants.js";

/**
 * WhatsAppConnection
 *
 * One Meta WhatsApp Business Account per tenant (per user). Tenant isolation is
 * enforced both by the unique `userId` index here and by every service query
 * filtering on `userId` — a user can only ever read or mutate their own record.
 *
 * The `accessToken` is marked `select: false` so it is never returned by a plain
 * query. Code that genuinely needs it (e.g. the sync verification call, and
 * later the message sender) must opt in with `.select('+accessToken')`.
 */
const whatsappConnectionSchema = new mongoose.Schema(
  {
    // Tenant owner. Unique → exactly one connection per tenant.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // Meta WhatsApp Business Account ID (WABA ID).
    businessAccountId: {
      type: String,
      required: [true, "Business account ID is required"],
      trim: true,
      unique: true,
    },

    // Phone number node ID — the primary key used by the messaging engine and
    // the webhook processor to map inbound events back to a tenant.
    phoneNumberId: {
      type: String,
      required: [true, "Phone number ID is required"],
      trim: true,
      unique: true,
    },

    // Display phone number in E.164-ish form (e.g. +14155551234).
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },

    businessName: {
      type: String,
      required: [true, "Business name is required"],
      trim: true,
      maxlength: [200, "Business name cannot exceed 200 characters"],
    },

    // Long-lived Meta access token. Sensitive — never selected by default,
    // and cleared on disconnect.
    accessToken: {
      type: String,
      required: [true, "Access token is required"],
      select: false,
    },

    status: {
      type: String,
      enum: CONNECTION_STATUS_VALUES,
      default: CONNECTION_STATUS.CONNECTED,
    },

    connectedAt: {
      type: Date,
      default: Date.now,
    },

    lastSyncAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// `userId` is already unique via the field option above (one connection per
// tenant). The indexes below support the lookups future modules will make:
//   • webhook processor / messaging engine resolve a tenant by phoneNumberId
//   • admin/ops tooling and the WABA references resolve by businessAccountId
//   • status filtering (e.g. "all connected tenants" for a broadcast)
whatsappConnectionSchema.index({ phoneNumberId: 1 }, { unique: true });

whatsappConnectionSchema.index({ businessAccountId: 1 }, { unique: true });
whatsappConnectionSchema.index({ status: 1 });

export default mongoose.model("WhatsAppConnection", whatsappConnectionSchema);
