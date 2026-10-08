import mongoose from "mongoose";

/**
 * Conversation
 *
 * One thread between the tenant's WhatsApp number and one contact.
 * Created automatically when the first inbound message arrives from a contact,
 * or when an outbound campaign message is sent (future).
 *
 * Tenant isolation: every query is scoped by userId.
 */
const conversationSchema = new mongoose.Schema(
  {
    // Tenant owner
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // The contact this conversation is with
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      default: null, // null if contact not in system yet
    },

    // Phone number of the other party (always stored for lookup)
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },

    // Display name (from Contact record or Meta profile)
    displayName: {
      type: String,
      default: null,
      trim: true,
    },

    // WhatsApp connection used for this conversation
    whatsappConnectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WhatsAppConnection",
      required: true,
    },

    // Snippet of last message for list view
    lastMessage: {
      type: String,
      default: null,
    },

    // Timestamp of last message (for sorting)
    lastMessageAt: {
      type: Date,
      default: null,
    },

    // Direction of last message: 'inbound' | 'outbound'
    lastMessageDirection: {
      type: String,
      enum: ["inbound", "outbound"],
      default: null,
    },

    // Unread inbound message count
    unreadCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Is conversation open or resolved
    status: {
      type: String,
      enum: ["open", "resolved"],
      default: "open",
    },

    // Whether the conversation has been archived by the tenant
    isArchived: {
      type: Boolean,
      default: false,
    },

    // Timestamp of when the conversation was archived
    archivedAt: {
      type: Date,
      default: null,
    },

    // Internal notes — visible only to the tenant's team, never sent to
    // the customer. Lives on Conversation (not Contact) so notes survive
    // even when contactId is null (deleted/unlinked contact).
    internalNotes: {
      type: String,
      default: null,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },

    // Per-conversation notification preferences
    preferences: {
      type: {
        muteNotifications: {
          type: Boolean,
          default: false,
        },

        muteSound: {
          type: Boolean,
          default: false,
        },
      },
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// One conversation per (userId, phoneNumber) pair
conversationSchema.index({ userId: 1, phoneNumber: 1 }, { unique: true });
conversationSchema.index({ userId: 1, lastMessageAt: -1 });
conversationSchema.index({ userId: 1, status: 1 });
conversationSchema.index({ userId: 1, contactId: 1 });
conversationSchema.index({ userId: 1, isArchived: 1, lastMessageAt: -1 });

export default mongoose.model("Conversation", conversationSchema);
