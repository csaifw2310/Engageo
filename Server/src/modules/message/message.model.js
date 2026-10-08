import mongoose from "mongoose";
import { MESSAGE_STATUS, MESSAGE_STATUS_VALUES } from "./message.constants.js";

const messageSchema = new mongoose.Schema(
  {
    // Tenant owner. Every query is scoped by this field.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // The conversation this message belongs to (null for old outbound-only messages)
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
    },

    // The campaign this message belongs to (null for inbound messages)
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      default: null,
    },

    // The recipient/sender contact
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      default: null,
    },

    // The template rendered into this message (null for inbound)
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Template",
      default: null,
    },

    // The connection (WABA phone number) this message is/was sent through.
    whatsappConnectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WhatsAppConnection",
      required: true,
    },

    // Direction of message
    direction: {
      type: String,
      enum: ["inbound", "outbound"],
      default: "outbound",
    },

    // Message content (text) — populated for inbound, optional for outbound
    content: {
      type: String,
      default: null,
    },

    // Message type: text, image, audio, video, document, etc.
    messageType: {
      type: String,
      default: "text",
    },

    durationSec: {
      type: Number,
      default: null,
    },

    // Hosted URL of the media (Cloudinary) for non-text messages. null for
    // plain text messages.
    mediaUrl: {
      type: String,
      default: null,
    },

    // Original filename for document messages ("Ravi_Pariyar_Resume.pdf").
    // Stored separately from `content` because content doubles as the caption
    // — without this field the chat UI has no name to show on the document
    // card after a reload, since the Cloudinary public_id is a random string.
    fileName: {
      type: String,
      default: null,
      trim: true,
    },

    // Size in bytes, used to render "PDF · 245 KB" on the chat document card.
    fileSize: {
      type: Number,
      default: null,
      min: 0,
    },

    // Meta's message id (wamid...) once accepted by the Cloud API.
    waMessageId: {
      type: String,
      default: null,
      trim: true,
    },

    // Phone number of sender (for inbound messages)
    fromPhone: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: MESSAGE_STATUS_VALUES,
      default: MESSAGE_STATUS.PENDING,
    },

    // ── Lifecycle timestamps ────────────────────────────────────────────────
    sentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },

    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    errorMessage: {
      type: String,
      default: null,
    },

    // physically removed — it's just excluded from that user's fetch queries.
    deletedFor: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },

    metaResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Core business rule: one outbound message per contact per campaign.
//
// The filter previously also required `conversationId: null`, which was a
// correct way to exclude chat messages back when campaign messages had no
// conversation. Now that they are linked to a thread, that clause would make
// the index match nothing and silently disable the double-send guard.
// `campaignId: { $ne: null }` already excludes chat messages on its own,
// since those always carry campaignId null.
//
// NOTE: changing a partialFilterExpression does NOT update an index that
// already exists — Mongoose only creates missing ones. Run
// scripts/migrations/2026-08-relink-campaign-conversations.js once per
// environment to drop and rebuild it.
messageSchema.index(
  { campaignId: 1, contactId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      campaignId: { $ne: null },
      contactId: { $ne: null },
    },
  },
);

messageSchema.index({ userId: 1, createdAt: -1 });
messageSchema.index({ userId: 1, status: 1 });
messageSchema.index({ userId: 1, campaignId: 1, status: 1 });
messageSchema.index({ userId: 1, contactId: 1 });
messageSchema.index({ userId: 1, conversationId: 1, createdAt: 1 });
messageSchema.index(
  { waMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { waMessageId: { $type: "string" } },
  },
);
messageSchema.index({ userId: 1, deliveredAt: 1 });
messageSchema.index({ userId: 1, readAt: 1 });
messageSchema.index({ userId: 1, direction: 1 });
messageSchema.index({ conversationId: 1, deletedFor: 1 });

export default mongoose.model("Message", messageSchema);