import Message from "./message.model.js";
import Campaign from "../campaign/campaign.model.js";
import Contact from "../contacts/contact/contact.model.js";
import Template from "../templates/template.model.js";
import WhatsAppConnection from "../whatsapp/whatsapp.model.js";
import Conversation from "../conversation/conversation.model.js";
import Membership from "../contacts/memberships/membership.model.js";
import ApiError from "../../utils/ApiError.js";
import { CAMPAIGN_STATUS } from "../campaign/campaign.constants.js";
import { CONNECTION_STATUS } from "../whatsapp/whatsapp.constants.js";
import { runQueue } from "../../config/message.queue.js";
import * as realSender from "./message.sender.js";
import * as mockSender from "../../utils/mock.sender.js";
import { normalizePhone } from "../../utils/phone.js";
import { socketEmitter } from "../../core/socket/index.js";
import {
  MESSAGE_STATUS,
  MESSAGE_SENDABLE_STATUSES,
  MESSAGE_SENT_STATUSES,
  MESSAGE_PENDING_STATUSES,
  MESSAGE_PAGINATION,
  MAX_RETRIES,
  SEND_CONCURRENCY,
  MESSAGE_MOCK_MODE,
  MESSAGE_MESSAGES,
} from "./message.constants.js";

// Escape user input before using it inside a RegExp (prevents ReDoS / injection).
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Pick the sender once at module load. The two senders share an identical
// contract, so nothing else in the service ever branches on mock vs real.
const sender = MESSAGE_MOCK_MODE ? mockSender : realSender;

/**
 * Messaging engine service.
 *
 * Responsibilities (and ONLY these — campaign lifecycle and webhook tracking
 * live in their own modules):
 *   • processCampaign  → expand a RUNNING campaign's groups into recipients and
 *                        materialise one PENDING Message per recipient.
 *   • sendMessage      → deliver a single message through the Cloud API.
 *   • sendCampaign     → deliver every still-pending message of a campaign,
 *                        concurrency-bounded via the queue.
 *   • retryFailedMessage → re-attempt a FAILED message (up to MAX_RETRIES).
 *   • list/get/getCampaignMessages → read paths.
 *
 * Every method is tenant-scoped: it takes the authenticated `userId` and only
 * ever reads or writes documents owned by that user. The campaign, contact,
 * template and connection are all re-checked against `userId` before use, so no
 * code path can touch another tenant's data.
 */
class MessageService {
  // ── Process: campaign → message records ─────────────────────────────────────

  /**
   * Expand a launched campaign into PENDING message records.
   *
   * Flow: Campaign → its Groups → distinct Contacts (deduped across groups) →
   * one Message per contact (status PENDING).
   *
   * The campaign must be RUNNING (i.e. already launched by the Campaign module).
   * Idempotent: the unique { campaignId, contactId } index plus an upsert means
   * re-running never creates duplicates and never disturbs messages that have
   * already advanced past PENDING.
   */
  async processCampaign(userId, campaignId) {
    const campaign = await this.#getRunningCampaign(userId, campaignId);

    // Groups → distinct contact ids (a contact in two target groups is counted
    // once). distinct() does the dedup for us.
    const memberIds = await Membership.distinct("contactId", {
      userId,
      groupId: { $in: campaign.groupIds },
    });

    // Keep only ids that still resolve to a live contact. A membership can
    // outlive its contact (historically it always did — deleting a contact
    // left the junction row behind), and materialising a message for one
    // produces a guaranteed failure that shows up in reporting as
    // "Unknown Contact / No phone".
    const liveContacts = await Contact.find({ userId, _id: { $in: memberIds } })
      .select("_id")
      .lean();
    const contactIds = liveContacts.map((c) => c._id);

    if (contactIds.length === 0) {
      throw new ApiError(400, MESSAGE_MESSAGES.NO_RECIPIENTS);
    }

    // Every recipient gets a conversation, so campaign sends land in the inbox
    // thread alongside chat replies instead of being invisible to it. Done as
    // two bulk round-trips rather than a per-contact getOrCreate, which would
    // be 2N queries on a campaign that can target thousands of contacts.
    const conversationByContact = await this.#linkConversations(
      userId,
      contactIds,
      campaign.whatsappConnectionId,
    );

    // Upsert one record per contact. $setOnInsert means existing messages keep
    // their current status (SENT/FAILED/...) on a re-process.
    const ops = contactIds.map((contactId) => ({
      updateOne: {
        filter: { userId, campaignId: campaign._id, contactId },
        update: {
          $setOnInsert: {
            userId,
            campaignId: campaign._id,
            contactId,
            conversationId:
              conversationByContact.get(String(contactId)) ?? null,
            templateId: campaign.templateId,
            whatsappConnectionId: campaign.whatsappConnectionId,
            status: MESSAGE_STATUS.PENDING,
          },
        },
        upsert: true,
      },
    }));

    const result = await Message.bulkWrite(ops, { ordered: false });
    const created = result.upsertedCount || 0;

    // Keep the campaign's recipient snapshot in step with what we materialised.
    await Campaign.updateOne(
      { _id: campaign._id, userId },
      { $set: { totalRecipients: contactIds.length } },
    );

    return {
      campaignId: String(campaign._id),
      totalRecipients: contactIds.length,
      created,
      alreadyExisted: contactIds.length - created,
    };
  }

  // ── Send: single message ────────────────────────────────────────────────────

  /**
   * Send one owned message. Allowed only from PENDING/QUEUED (prevents
   * double-send); FAILED messages must go through retryFailedMessage().
   *
   * On failure the document is persisted as FAILED (with retryCount++/error)
   * and an ApiError is thrown so the endpoint reports the failure.
   */
  async sendMessage(userId, messageId) {
    const message = await Message.findOne({ _id: messageId, userId });
    if (!message) throw new ApiError(404, MESSAGE_MESSAGES.NOT_FOUND);

    if (MESSAGE_SENT_STATUSES.includes(message.status)) {
      throw new ApiError(409, MESSAGE_MESSAGES.ALREADY_SENT);
    }
    if (!MESSAGE_SENDABLE_STATUSES.includes(message.status)) {
      // e.g. FAILED — direct send is not the right path.
      throw new ApiError(409, MESSAGE_MESSAGES.NOT_FAILED);
    }

    // Sync counters even if the send fails (the message is saved FAILED), so the
    // campaign rollups stay accurate regardless of outcome.
    await this.#withCounterSync(userId, message.campaignId, () =>
      this.#dispatch(userId, message),
    );

    return message;
  }

  // ── Send: single conversation (chat) message ───────────────────────────────
  // `media` (optional) = { mediaUrl, mediaType } — when present, sends via
  // Cloud API's media message shape instead of text. `content` doubles as
  // the caption for image/video/document (ignored for audio, see
  // sendMediaMessage's own note) and is still required either way so every
  // message has a persisted content string for the conversation preview /
  // list snippet.
  async sendConversationMessage(
    userId,
    {
      conversationId,
      phoneNumber,
      whatsappConnectionId,
      content,
      media = null,
    },
  ) {
    if (!content?.trim())
      throw new ApiError(400, "Message content is required");

    if (media?.mediaUrl && !media?.mediaType) {
      throw new ApiError(
        400,
        "mediaType is required when mediaUrl is provided",
      );
    }

    const result = normalizePhone(phoneNumber);

    if (!result.success) {
      throw new ApiError(400, result.error);
    }

    phoneNumber = result.waId;

    const connection = await this.#resolveConnectionForSend(
      userId,
      whatsappConnectionId,
    );

    const isMedia = !!media?.mediaUrl;

    const message = await Message.create({
      userId,
      conversationId,
      whatsappConnectionId,
      content,
      messageType: isMedia ? media.mediaType : "text",
      mediaUrl: isMedia ? media.mediaUrl : null,
      fileName: isMedia && media.filename ? media.filename : null,
      fileSize: isMedia && media.fileSize ? Number(media.fileSize) : null,
      durationSec:
        isMedia && media.durationSec != null ? media.durationSec : null,
      direction: "outbound",
      status: MESSAGE_STATUS.PENDING,
    });

    try {
      const { waMessageId, raw } = isMedia
        ? await sender.sendMediaMessage({
            phoneNumberId: connection.phoneNumberId,
            accessToken: connection.accessToken,
            to: phoneNumber,
            mediaUrl: media.mediaUrl,
            mediaType: media.mediaType,
            filename: media.filename ?? null,
            // A caption-less document send stores the filename as `content`
            // (it's required for the conversation snippet). Don't echo that
            // back as a caption too, or the recipient sees the name twice.
            caption: content === media.filename ? "" : content,
          })
        : await sender.sendTextMessage({
            phoneNumberId: connection.phoneNumberId,
            accessToken: connection.accessToken,
            to: phoneNumber,
            content,
          });

      message.status = MESSAGE_STATUS.SENT;
      message.waMessageId = waMessageId;
      message.sentAt = new Date();
      message.metaResponse = raw;
      message.errorMessage = null;
      message.failedAt = null;
      await message.save();
      return message;
    } catch (err) {
      message.status = MESSAGE_STATUS.FAILED;
      message.failedAt = new Date();
      message.retryCount = (message.retryCount || 0) + 1;
      message.errorMessage = err?.message ?? "Send failed";
      if (err instanceof ApiError && err.errors?.length) {
        message.metaResponse = err.errors[0];
      }
      await message.save();
      throw err instanceof ApiError
        ? err
        : new ApiError(502, err?.message ?? "Send failed");
    }
  }

  // ── Send: whole campaign ────────────────────────────────────────────────────

  /**
   * Send every still-pending (PENDING/QUEUED) message of a launched campaign,
   * concurrency-bounded by the queue. Individual failures are isolated — one bad
   * recipient never aborts the batch.
   *
   * Returns a per-pass summary; the campaign counters are recomputed from the
   * messages collection afterwards (idempotent, never double-counts on retries),
   * and the campaign is marked COMPLETED once nothing remains in flight.
   */
  async sendCampaign(userId, campaignId) {
    const campaign = await this.#getRunningCampaign(userId, campaignId);

    const pending = await Message.find({
      userId,
      campaignId: campaign._id,
      status: { $in: MESSAGE_PENDING_STATUSES },
    });

    if (pending.length === 0) {
      // Nothing to do — still resync counters so the response is truthful.
      const counters = await this.#syncCampaignCounters(userId, campaign._id);
      return {
        campaignId: String(campaign._id),
        attempted: 0,
        sent: 0,
        failed: 0,
        ...counters,
        message: MESSAGE_MESSAGES.NOTHING_TO_SEND,
      };
    }

    // Mark the batch QUEUED before handing it to the dispatcher.
    await Message.updateMany(
      { _id: { $in: pending.map((m) => m._id) }, userId },
      { $set: { status: MESSAGE_STATUS.QUEUED } },
    );

    // Resolve the connection + token ONCE for the whole batch instead of per
    // message — every message in a campaign shares the campaign's connection.
    const connection = await this.#resolveConnectionForSend(
      userId,
      campaign.whatsappConnectionId,
    );

    const results = await runQueue(
      pending,
      async (message) => {
        // Re-load the live doc so retryCount/status are current, then dispatch.
        const fresh = await Message.findOne({ _id: message._id, userId });
        if (!fresh) return; // deleted mid-flight — skip
        await this.#dispatch(userId, fresh, connection);
      },
      { concurrency: SEND_CONCURRENCY },
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - sent;

    const counters = await this.#syncCampaignCounters(userId, campaign._id);

    return {
      campaignId: String(campaign._id),
      attempted: results.length,
      sent,
      failed,
      ...counters,
    };
  }

  // ── Retry a failed message ──────────────────────────────────────────────────

  /**
   * Re-attempt a FAILED owned message. Refuses once retryCount hits MAX_RETRIES.
   */
  async retryFailedMessage(userId, messageId) {
    const message = await Message.findOne({ _id: messageId, userId });
    if (!message) throw new ApiError(404, MESSAGE_MESSAGES.NOT_FOUND);

    if (message.status !== MESSAGE_STATUS.FAILED) {
      throw new ApiError(409, MESSAGE_MESSAGES.NOT_FAILED);
    }
    if (message.retryCount >= MAX_RETRIES) {
      throw new ApiError(409, MESSAGE_MESSAGES.MAX_RETRIES_EXCEEDED);
    }

    await this.#withCounterSync(userId, message.campaignId, () =>
      this.#dispatch(userId, message),
    );

    return message;
  }

  // ── Read paths ──────────────────────────────────────────────────────────────

  /** List a tenant's messages with status filter + search + pagination. */
  async listMessages(userId, options = {}) {
    const filter = { userId };
    if (options.status) filter.status = options.status;
    if (options.campaignId) filter.campaignId = options.campaignId;

    if (options.search) {
      const rx = new RegExp(escapeRegex(String(options.search).trim()), "i");
      filter.$or = [{ waMessageId: rx }, { errorMessage: rx }];
    }

    return this.#paginate(filter, options);
  }

  /** Fetch a single owned message (404 if not found OR not owned). */
  async getMessage(userId, id) {
    const message = await Message.findOne({ _id: id, userId }).lean();
    if (!message) throw new ApiError(404, MESSAGE_MESSAGES.NOT_FOUND);
    return message;
  }

  /**
   * List all messages for one owned campaign (status filter + pagination).
   * Verifies campaign ownership first so a 404 distinguishes "not your campaign"
   * from "your campaign, no messages".
   */
  async getCampaignMessages(userId, campaignId, options = {}) {
    const campaign = await Campaign.findOne({ _id: campaignId, userId })
      .select("_id")
      .lean();
    if (!campaign) throw new ApiError(404, MESSAGE_MESSAGES.CAMPAIGN_NOT_FOUND);

    const filter = { userId, campaignId };
    if (options.status) filter.status = options.status;

    return this.#paginate(filter, options);
  }

  // ── Internal: delivery ──────────────────────────────────────────────────────

  /**
   * Perform a single send for an already-loaded, owned message document.
   * Resolves the contact/template/connection (all tenant-scoped), calls the
   * active sender, and writes the outcome back to the document.
   *
   * On success → status SENT, sentAt, waMessageId, metaResponse, error cleared.
   * On failure → status FAILED, failedAt, retryCount++, errorMessage,
   *              metaResponse, then RE-THROWS the ApiError so single-send callers
   *              report it. Bulk callers catch it via the queue.
   *
   * `presetConnection` lets sendCampaign resolve the connection once for the
   * whole batch; when omitted it is resolved per call.
   */
  /**
   * Ensure every contact in `contactIds` has a Conversation, and return a
   * Map of contactId -> conversationId.
   *
   * Deliberately talks to the Conversation model directly rather than calling
   * conversationService.getOrCreate: that service already imports this one, so
   * importing it back would create a module cycle, and its per-contact
   * round-trips would not scale to a large campaign.
   *
   * Conversations are keyed by phone number (unique on { userId, phoneNumber }),
   * so a contact who has already chatted in reuses that same thread instead of
   * getting a duplicate.
   */
  async #linkConversations(userId, contactIds, whatsappConnectionId) {
    const contacts = await Contact.find({ userId, _id: { $in: contactIds } })
      .select("_id name phoneNumber")
      .lean();

    const map = new Map();
    if (contacts.length === 0) return map;

    await Conversation.bulkWrite(
      contacts.map((c) => ({
        updateOne: {
          filter: { userId, phoneNumber: c.phoneNumber },
          update: {
            // $setOnInsert only: never clobber a display name the user edited
            // or an archived/resolved status on an existing thread.
            $setOnInsert: {
              userId,
              phoneNumber: c.phoneNumber,
              whatsappConnectionId,
              contactId: c._id,
              displayName: c.name || c.phoneNumber,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );

    const conversations = await Conversation.find({
      userId,
      phoneNumber: { $in: contacts.map((c) => c.phoneNumber) },
    })
      .select("_id phoneNumber")
      .lean();

    const byPhone = new Map(
      conversations.map((cv) => [cv.phoneNumber, cv._id]),
    );

    for (const c of contacts) {
      const conversationId = byPhone.get(c.phoneNumber);
      if (conversationId) map.set(String(c._id), conversationId);
    }

    return map;
  }

  /**
   * Bubble a just-sent campaign message into its conversation thread: refresh
   * the list snippet and push it to any inbox that has the thread open.
   *
   * Mirrors what conversationService.sendMessage does for chat sends, but
   * written against the models directly to avoid a module cycle (see
   * #linkConversations). Unread is deliberately NOT incremented — this is an
   * outbound message, and the tenant sent it themselves.
   *
   * Best-effort: a socket or snippet failure must never mark a delivered
   * message as failed.
   */
  async #touchConversation(userId, message) {
    if (!message.conversationId) return;

    try {
      const conversation = await Conversation.findOneAndUpdate(
        { _id: message.conversationId, userId },
        {
          $set: {
            lastMessage: (message.content ?? "").slice(0, 100),
            lastMessageAt: message.sentAt ?? new Date(),
            lastMessageDirection: "outbound",
          },
        },
        { new: true },
      ).lean();

      if (!conversation) return;

      socketEmitter.conversationUpdated(String(userId), {
        conversationId: String(conversation._id),
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        unreadCount: conversation.unreadCount,
      });

      socketEmitter.newMessage(
        String(userId),
        String(conversation._id),
        message,
      );
    } catch (err) {
      console.error(
        "[message] conversation update failed:",
        err?.message || err,
      );
    }
  }

  async #dispatch(userId, message, presetConnection = null) {
    const [contact, template, connection] = await Promise.all([
      Contact.findOne({ _id: message.contactId, userId }).lean(),
      Template.findOne({ _id: message.templateId, userId })
        .select("name language bodyText")
        .lean(),
      presetConnection
        ? Promise.resolve(presetConnection)
        : this.#resolveConnectionForSend(userId, message.whatsappConnectionId),
    ]);

    // Missing references are a hard, non-retryable failure for this message.
    if (!contact) {
      return this.#fail(message, MESSAGE_MESSAGES.CONTACT_NOT_FOUND, 404);
    }
    if (!template) {
      return this.#fail(message, MESSAGE_MESSAGES.TEMPLATE_NOT_FOUND, 404);
    }

    try {
      const { waMessageId, raw } = await sender.sendTemplateMessage({
        phoneNumberId: connection.phoneNumberId,
        accessToken: connection.accessToken,
        to: contact.phoneNumber,
        templateName: template.name,
        languageCode: template.language,
      });

      message.status = MESSAGE_STATUS.SENT;
      message.waMessageId = waMessageId;
      message.sentAt = new Date();
      message.errorMessage = null;
      message.failedAt = null;
      message.metaResponse = raw;
      // Meta renders the template on its side, so nothing here would otherwise
      // hold the text — the chat bubble would be blank. Store the template body
      // so the thread and the conversation-list snippet have something to show.
      if (!message.content) {
        message.content = template.bodyText || `[${template.name}]`;
      }
      await message.save();

      await this.#touchConversation(userId, message);
      return message;
    } catch (err) {
      const status = err instanceof ApiError ? err.statusCode : 502;
      const detail =
        (err instanceof ApiError && err.errors?.length && err.errors[0]) ||
        null;
      return this.#fail(message, err.message, status, detail);
    }
  }

  /**
   * Persist a message as FAILED (bumping retryCount) and throw a matching
   * ApiError. Centralises the failure write so every failure path is identical.
   */
  async #fail(message, errorMessage, statusCode = 502, detail = null) {
    message.status = MESSAGE_STATUS.FAILED;
    message.failedAt = new Date();
    message.retryCount = (message.retryCount || 0) + 1;
    message.errorMessage = errorMessage;
    if (detail) message.metaResponse = detail;
    await message.save();
    throw new ApiError(statusCode, errorMessage);
  }

  // ── Internal: helpers (all tenant-scoped) ───────────────────────────────────

  /** Fetch an owned campaign and assert it is RUNNING (i.e. launched). */
  async #getRunningCampaign(userId, campaignId) {
    const campaign = await Campaign.findOne({ _id: campaignId, userId });
    if (!campaign) throw new ApiError(404, MESSAGE_MESSAGES.CAMPAIGN_NOT_FOUND);
    if (campaign.status !== CAMPAIGN_STATUS.RUNNING) {
      throw new ApiError(409, MESSAGE_MESSAGES.CAMPAIGN_NOT_RUNNING);
    }
    return campaign;
  }

  /**
   * Resolve the owned connection for sending and assert it is CONNECTED, opting
   * in to the normally-hidden accessToken. Used by both single and bulk sends.
   */
  async #resolveConnectionForSend(userId, whatsappConnectionId) {
    const connection = await WhatsAppConnection.findOne({
      _id: whatsappConnectionId,
      userId,
    }).select("+accessToken phoneNumberId status");

    if (!connection) {
      throw new ApiError(404, MESSAGE_MESSAGES.CONNECTION_NOT_FOUND);
    }
    if (connection.status !== CONNECTION_STATUS.CONNECTED) {
      throw new ApiError(400, MESSAGE_MESSAGES.CONNECTION_NOT_CONNECTED);
    }
    return connection;
  }

  /**
   * Run a single-message operation and ALWAYS resync the campaign counters
   * afterwards — whether it succeeded or threw — so a failed send is still
   * reflected in totalFailed. Re-throws the original error to the caller.
   */
  async #withCounterSync(userId, campaignId, op) {
    try {
      return await op();
    } finally {
      await this.#syncCampaignCounters(userId, campaignId);
    }
  }

  /**
   * Recompute a campaign's send-side counters from the messages collection and
   * stamp completion when nothing remains in flight. Idempotent and race-safe —
   * it counts rather than increments, so retries can't double-count.
   *
   * NOTE: only totalSent / totalFailed (and completion) are owned here.
   * totalDelivered / totalRead are owned by the Webhook module and are left
   * untouched.
   */
  async #syncCampaignCounters(userId, campaignId) {
    const [total, sent, failed, stillPending] = await Promise.all([
      Message.countDocuments({ userId, campaignId }),
      Message.countDocuments({
        userId,
        campaignId,
        status: { $in: MESSAGE_SENT_STATUSES },
      }),
      Message.countDocuments({
        userId,
        campaignId,
        status: MESSAGE_STATUS.FAILED,
      }),
      Message.countDocuments({
        userId,
        campaignId,
        status: { $in: MESSAGE_PENDING_STATUSES },
      }),
    ]);

    const update = { totalSent: sent, totalFailed: failed };

    // A send pass is "complete" once there is at least one message and none are
    // still pending/queued. Only advance a RUNNING campaign (never override a
    // CANCELLED/COMPLETED one).
    let markCompleted = false;
    if (total > 0 && stillPending === 0) {
      markCompleted = true;
      update.completedAt = new Date();
    }

    await Campaign.updateOne(
      {
        _id: campaignId,
        userId,
        ...(markCompleted ? { status: CAMPAIGN_STATUS.RUNNING } : {}),
      },
      {
        $set: markCompleted
          ? { ...update, status: CAMPAIGN_STATUS.COMPLETED }
          : update,
      },
    );

    return { totalSent: sent, totalFailed: failed, totalMessages: total };
  }

  /** Shared pagination for the message list endpoints. */
  async #paginate(filter, options) {
    const page = Math.max(
      parseInt(options.page, 10) || MESSAGE_PAGINATION.DEFAULT_PAGE,
      1,
    );
    const limit = Math.min(
      Math.max(
        parseInt(options.limit, 10) || MESSAGE_PAGINATION.DEFAULT_LIMIT,
        1,
      ),
      MESSAGE_PAGINATION.MAX_LIMIT,
    );
    const skip = (page - 1) * limit;

    const [messages, totalMessages] = await Promise.all([
      Message.find(filter)
        .populate("contactId", "name phoneNumber")
        .populate("campaignId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Message.countDocuments(filter),
    ]);

    return {
      messages,
      totalMessages,
      totalPages: Math.ceil(totalMessages / limit) || 0,
      currentPage: page,
    };
  }
}

export default new MessageService();