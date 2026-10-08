import Conversation from "./conversation.model.js";
import Message from "../message/message.model.js";
import Contact from "../contacts/contact/contact.model.js";
import WhatsAppConnection from "../whatsapp/whatsapp.model.js";
import ApiError from "../../utils/ApiError.js";
import messageService from "../message/message.service.js";
import { socketEmitter } from "../../core/socket/index.js";
import { normalizePhone } from "../../utils/phone.js";

class ConversationService {
  async getOrCreate(
    userId,
    phoneNumber,
    whatsappConnectionId,
    displayName = null,
  ) {
    const result = normalizePhone(phoneNumber);

    if (!result.success) {
      throw new ApiError(400, result.error);
    }
    phoneNumber = result.waId;

    const contact = await Contact.findOne({ userId, phoneNumber }).lean();

    let conversation = await Conversation.findOne({ userId, phoneNumber });
    if (conversation) {
      const newName = contact?.name || displayName;

      if (newName && conversation.displayName !== newName) {
        conversation.displayName = newName;
        conversation.contactId = contact?._id ?? conversation.contactId;
        await conversation.save();
      }

      return conversation;
    }

    conversation = await Conversation.create({
      userId,
      phoneNumber,
      whatsappConnectionId,
      contactId: contact?._id ?? null,
      displayName: contact?.name || displayName || phoneNumber,
    });

    return conversation;
  }

  async getOrCreateByPhone(userId, phoneNumber, displayName = null) {
    const connection = await WhatsAppConnection.findOne({ userId }).lean();
    if (!connection) {
      throw new ApiError(400, "WhatsApp is not connected for this account");
    }

    const conversation = await this.getOrCreate(
      userId,
      phoneNumber,
      connection._id,
      displayName,
    );

    return this.getConversation(userId, conversation._id);
  }

  async updateLastMessage(conversationId, text, direction) {
    const set = {
      lastMessage: text?.slice(0, 100) ?? "",
      lastMessageAt: new Date(),
      lastMessageDirection: direction,
    };

    const update = { $set: set };
    if (direction === "inbound") update.$inc = { unreadCount: 1 };

    return Conversation.findByIdAndUpdate(conversationId, update, {
      new: true,
    });
  }

  async listConversations(userId, options = {}) {
    const page = Math.max(parseInt(options.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(options.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;

    // Default view is the inbox — archived conversations are excluded
    // unless the caller explicitly asks for them (?archived=true).
    const filter = {
      userId,
      isArchived: options.archived === "true" || options.archived === true,
    };
    if (options.status) filter.status = options.status;

    const [conversations, total] = await Promise.all([
      Conversation.find(filter)
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("contactId", "name phoneNumber email tags")
        .lean(),
      Conversation.countDocuments(filter),
    ]);

    return {
      conversations,
      total,
      totalPages: Math.ceil(total / limit) || 0,
      currentPage: page,
    };
  }

  async getConversation(userId, conversationId) {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId,
    })
      .populate("contactId", "name phoneNumber email tags")
      .lean();

    if (!conversation) throw new ApiError(404, "Conversation not found");
    return conversation;
  }

  // ── FIXED ──────────────────────────────────────────────────────────────
  // Page 1 now returns the NEWEST `limit` messages instead of the OLDEST.
  // Previously this always did skip:0, limit:50 sorted ascending — which
  // silently returned only the oldest 50 messages and dropped everything
  // newer once a conversation passed 50 total messages.
  // NEW
  async getMessages(userId, conversationId, options = {}) {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId,
    }).lean();
    if (!conversation) throw new ApiError(404, "Conversation not found");

    const page = Math.max(parseInt(options.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(options.limit, 10) || 50, 1), 100);

    // Exclude messages this user has "deleted for me" — row still exists,
    // just hidden from their own view.
    const filter = { userId, conversationId, deletedFor: { $ne: userId } };

    const total = await Message.countDocuments(filter);
    const totalPages = Math.ceil(total / limit) || 0;

    const skip = Math.max(total - page * limit, 0);
    const take = Math.min(limit, total - skip);

    const messages = await Message.find(filter)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(take)
      .lean();

    return { messages, total, totalPages, currentPage: page };
  }
  // ──────────────────────────────────────────────────────────────────────

  async markAsRead(userId, conversationId) {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId,
    });
    if (!conversation) throw new ApiError(404, "Conversation not found");

    conversation.unreadCount = 0;
    await conversation.save();
    return conversation;
  }

  async updateStatus(userId, conversationId, status) {
    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, userId },
      { $set: { status } },
      { new: true },
    );
    if (!conversation) throw new ApiError(404, "Conversation not found");
    return conversation;
  }

  async archiveConversation(userId, conversationId) {
    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, userId },
      { $set: { isArchived: true, archivedAt: new Date() } },
      { new: true },
    );
    if (!conversation) throw new ApiError(404, "Conversation not found");

    socketEmitter.conversationUpdated(String(userId), conversation);

    return conversation;
  }

  async unarchiveConversation(userId, conversationId) {
    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, userId },
      { $set: { isArchived: false, archivedAt: null } },
      { new: true },
    );
    if (!conversation) throw new ApiError(404, "Conversation not found");

    socketEmitter.conversationUpdated(String(userId), conversation);

    return conversation;
  }

  async updateNotes(userId, conversationId, notes) {
    if (notes && notes.length > 500) {
      throw new ApiError(400, "Notes cannot exceed 500 characters");
    }

    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, userId },
      { $set: { internalNotes: notes || null } },
      { new: true, runValidators: true },
    );
    if (!conversation) throw new ApiError(404, "Conversation not found");
    return conversation;
  }

  async updatePreferences(userId, conversationId, preferences = {}) {
    if (
      preferences.muteNotifications === undefined &&
      preferences.muteSound === undefined
    ) {
      throw new ApiError(400, "No preferences provided");
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId,
    });
    if (!conversation) throw new ApiError(404, "Conversation not found");

    if (preferences.muteNotifications !== undefined) {
      conversation.preferences.muteNotifications =
        preferences.muteNotifications;
    }
    if (preferences.muteSound !== undefined) {
      conversation.preferences.muteSound = preferences.muteSound;
    }

    await conversation.save();

    socketEmitter.conversationUpdated(String(userId), conversation);

    return conversation;
  }

  async sendMessage(userId, conversationId, content, media = null) {
    if (!content?.trim())
      throw new ApiError(400, "Message content is required");

    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId,
    });
    if (!conversation) throw new ApiError(404, "Conversation not found");

    const message = await messageService.sendConversationMessage(userId, {
      conversationId: conversation._id,
      phoneNumber: conversation.phoneNumber,
      whatsappConnectionId: conversation.whatsappConnectionId,
      content,
      media,
    });

    const updatedConversation = await this.updateLastMessage(
      conversation._id,
      content,
      "outbound",
    );

    socketEmitter.conversationUpdated(String(userId), updatedConversation);

    socketEmitter.newMessage(String(userId), String(conversation._id), message);

    return { message };
  }

  /**
   * Persist an edited display name to the Conversation, and — since the
   * Contact record is the canonical CRM identity — keep a linked Contact's
   * name in sync too, so an edit made from the chat panel doesn't drift
   * from what Contacts page shows.
   */
  async updateDisplayName(userId, conversationId, displayName) {
    const trimmed = (displayName || "").trim();
    if (!trimmed) throw new ApiError(400, "Name is required");
    if (trimmed.length > 120) {
      throw new ApiError(400, "Name cannot exceed 120 characters");
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId,
    });
    if (!conversation) throw new ApiError(404, "Conversation not found");

    conversation.displayName = trimmed;
    await conversation.save();

    if (conversation.contactId) {
      await Contact.findOneAndUpdate(
        { _id: conversation.contactId, userId },
        { $set: { name: trimmed } },
      );
    }

    socketEmitter.conversationUpdated(String(userId), conversation);

    return this.getConversation(userId, conversationId);
  }

  /**
   * Link an EXISTING contact to a conversation whose contactId is null
   * (or was dangling after the original contact got deleted).
   */
  /**
   * Find a Contact that exactly matches this conversation's phoneNumber but
   * isn't linked yet — the "Contact and Conversation exist independently,
   * just never got connected" case (e.g. contact created via CSV import or
   * manually, before/after the WhatsApp thread existed).
   * Returns null if no such contact exists.
   */
  async findMatchingContact(userId, conversationId) {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId,
    }).lean();
    if (!conversation) throw new ApiError(404, "Conversation not found");

    const contact = await Contact.findOne({
      userId,
      phoneNumber: conversation.phoneNumber,
    }).lean();

    return contact || null;
  }

  /**
   * Link an EXISTING contact to a conversation whose contactId is null
   * (or was dangling after the original contact got deleted).
   *
   * STRICT RULE: a contact can only be linked to a conversation if its
   * phoneNumber exactly matches the conversation's phoneNumber. A WhatsApp
   * thread and a CRM contact represent the same real-world phone number —
   * linking a mismatched pair would silently misattribute chat history to
   * the wrong person. This is enforced here (not just in the UI) so no
   * caller can bypass it.
   */
  async linkContact(userId, conversationId, contactId) {
    if (!contactId) throw new ApiError(400, "contactId is required");

    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId,
    });
    if (!conversation) throw new ApiError(404, "Conversation not found");

    const contact = await Contact.findOne({ _id: contactId, userId });
    if (!contact) throw new ApiError(404, "Contact not found");

    if (contact.phoneNumber !== conversation.phoneNumber) {
      throw new ApiError(
        400,
        `Cannot link this contact — its phone number (${contact.phoneNumber}) does not match this conversation's number (${conversation.phoneNumber}). Create a new contact instead.`,
      );
    }

    conversation.contactId = contact._id;
    if (
      !conversation.displayName ||
      conversation.displayName === conversation.phoneNumber
    ) {
      conversation.displayName = contact.name;
    }
    await conversation.save();

    socketEmitter.conversationUpdated(String(userId), conversation);

    return this.getConversation(userId, conversationId);
  }

  /**
   * Create a brand-new contact (phoneNumber pre-filled from the conversation)
   * and link it in one step — used by the "Link Contact" popup's
   * "Create new contact" path.
   */
  async createAndLinkContact(userId, conversationId, data) {
    if (!data?.name?.trim()) throw new ApiError(400, "Name is required");

    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId,
    });
    if (!conversation) throw new ApiError(404, "Conversation not found");

    let contact;
    try {
      contact = await Contact.create({
        userId,
        name: data.name,
        phoneNumber: conversation.phoneNumber,
        email: data.email || null,
        tags: data.tags || [],
        status: "active",
      });
    } catch (err) {
      if (err && err.code === 11000) {
        const existing = await Contact.findOne({
          userId,
          phoneNumber: conversation.phoneNumber,
        }).lean();
        throw new ApiError(
          409,
          "A contact with this phone number already exists",
          existing ? [{ existingContactId: existing._id }] : [],
        );
      }
      throw err;
    }

    conversation.contactId = contact._id;
    conversation.displayName = contact.name;
    await conversation.save();

    socketEmitter.conversationUpdated(String(userId), conversation);

    return this.getConversation(userId, conversationId);
  }

  /**
   * "Delete for me" — hides one message from this user's view only. The row
   * is never physically removed (soft delete), so campaign counters and
   * reply references stay intact.
   */
  async deleteMessageForMe(userId, conversationId, messageId) {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId,
    }).lean();
    if (!conversation) throw new ApiError(404, "Conversation not found");

    const result = await Message.updateOne(
      { _id: messageId, userId, conversationId },
      { $addToSet: { deletedFor: userId } },
    );
    if (result.matchedCount === 0) {
      throw new ApiError(404, "Message not found");
    }

    return { messageId, deleted: true };
  }
}

export default new ConversationService();
