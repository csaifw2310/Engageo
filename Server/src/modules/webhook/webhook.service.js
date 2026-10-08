import Message from "../message/message.model.js";
import Campaign from "../campaign/campaign.model.js";
import Conversation from "../conversation/conversation.model.js";
import WhatsAppConnection from "../whatsapp/whatsapp.model.js";
import { MESSAGE_STATUS } from "../message/message.constants.js";
import { CAMPAIGN_STATUS } from "../campaign/campaign.constants.js";
import conversationService from "../conversation/conversation.service.js";
import { socketEmitter } from "../../core/socket/index.js";
import notificationEvents from "../notifications/notification.events.js";
import cloudinary from "../../config/cloudinary.js";
import { GRAPH_API_BASE_URL } from "../whatsapp/whatsapp.constants.js";
import {
  WEBHOOK_STATUS_MAP,
  WEBHOOK_STATUS_TRANSITIONS,
  WEBHOOK_STATUS_TIMESTAMP,
  WEBHOOK_DELIVERED_STATUSES,
  WEBHOOK_IN_FLIGHT_STATUSES,
  WEBHOOK_VERIFY_MODE,
  WEBHOOK_RESULT,
  WEBHOOK_MESSAGES,
  getWebhookVerifyToken,
} from "./webhook.constants.js";

// Uploads a raw buffer to Cloudinary via upload_stream. Same pattern used in
// media.controller.js for outbound voice notes — copied here locally since
// that helper isn't exported anywhere shared.
function uploadBufferToCloudinary(buffer, folder, resourceType) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      },
    );
    stream.end(buffer);
  });
}

class WebhookService {
  // ── Verification (GET handshake) ────────────────────────────────────────────

  verifyWebhook({ mode, token, challenge }) {
    const expected = getWebhookVerifyToken();
    const ok = mode === WEBHOOK_VERIFY_MODE && !!expected && token === expected;
    return ok ? challenge : null;
  }

  // ── Receiver (POST payload) ─────────────────────────────────────────────────

  async processWebhook(payload) {
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];

    let processed = 0;
    let ignored = 0;

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value;
        if (!value) continue;

        // ── Inbound messages ──────────────────────────────────────────────
        const messages = value?.messages;
        if (Array.isArray(messages)) {
          for (const msg of messages) {
            try {
              await this.#processInboundMessage(value, msg);
              processed++;
            } catch (err) {
              ignored++;
              console.error(
                "[webhook] inbound message error:",
                err?.message || err,
              );
            }
          }
        }

        // ── Delivery status callbacks ─────────────────────────────────────
        const statuses = value?.statuses;
        if (Array.isArray(statuses)) {
          for (const statusEvent of statuses) {
            try {
              const result = await this.processStatusEvent(statusEvent);
              if (result === WEBHOOK_RESULT.PROCESSED) processed++;
              else ignored++;
            } catch (err) {
              ignored++;
              console.error(
                "[webhook] event processing error:",
                err?.message || err,
              );
            }
          }
        }
      }
    }

    return { processed, ignored };
  }

  // ── Inbound media resolver ───────────────────────────────────────────────────

  /**
   * Cloudinary resource_type for a given WhatsApp media type.
   *   image / sticker → "image"  (stickers are .webp)
   *   audio / video   → "video"  (Cloudinary files audio under "video")
   *   document        → "raw"    (pdf, docx, xlsx … stored verbatim)
   */
  #cloudinaryResourceType(messageType) {
    if (messageType === "image" || messageType === "sticker") return "image";
    if (messageType === "audio" || messageType === "video") return "video";
    return "raw";
  }

  /**
   * Inbound media arrives as a `media_id`, not a URL — for EVERY media type,
   * not just audio. Resolving it requires:
   *   1. GET /{media_id} on the Graph API (auth'd) -> short-lived URL
   *   2. GET that URL (also auth'd) -> the actual bytes
   *   3. Upload those bytes to Cloudinary for a permanent, public URL the
   *      frontend can render with no auth header.
   *
   * Without step 3 the chat UI has nothing to show: Meta's URL is both
   * short-lived and requires a bearer token, so it can't go in an <img src>.
   */
  async #resolveInboundMediaUrl(mediaId, connection, userId, messageType) {
    const accessToken = connection.accessToken;

    // Previously read process.env.WHATSAPP_API_VERSION — a key that doesn't
    // exist in .env — so this silently pinned every media lookup to v20.0
    // while the rest of the app ran on META_GRAPH_API_VERSION.
    const metaRes = await fetch(`${GRAPH_API_BASE_URL}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) {
      throw new Error(`media lookup failed: ${metaRes.status}`);
    }

    const { url, mime_type: mimeType } = await metaRes.json();
    if (!url) throw new Error("no url returned for media_id");

    const fileRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!fileRes.ok) {
      throw new Error(`media download failed: ${fileRes.status}`);
    }

    const buffer = Buffer.from(await fileRes.arrayBuffer());

    const uploaded = await uploadBufferToCloudinary(
      buffer,
      `engageo/${userId}`,
      this.#cloudinaryResourceType(messageType),
    );

    return { url: uploaded.secure_url, bytes: uploaded.bytes, mimeType };
  }

  // ── Inbound message handler ─────────────────────────────────────────────────

  async #processInboundMessage(value, msg) {
    const fromPhone = msg?.from;
    const waMessageId = msg?.id;
    const timestamp = msg?.timestamp;
    const phoneNumberId = value?.metadata?.phone_number_id;

    if (!fromPhone || !waMessageId || !phoneNumberId) return;

    // Find which tenant owns this phone number id.
    // accessToken is `select: false` on the schema (sensitive field), so it
    // must be explicitly requested here — without this, connection.accessToken
    // would be undefined and the inbound-audio Graph API calls would 401.
    const connection = await WhatsAppConnection.findOne({
      phoneNumberId,
    })
      .select("+accessToken")
      .lean();
    if (!connection) {
      //debug log
      console.log(
        `[webhook] no connection found for phoneNumberId=${phoneNumberId}`,
      );
      return;
    }

    const userId = connection.userId;

    // Extract message content
    const { text, messageType, mediaId, fileName, fileSize } =
      this.#extractContent(msg);

    // Resolve ANY inbound media (image, sticker, video, document, audio) to a
    // permanent Cloudinary URL. Previously only audio was resolved, so photos,
    // stickers and documents landed in the inbox as bare "[Image]" /
    // "[Sticker]" text with no file behind them.
    // Best-effort: a failure here must never drop the whole inbound message.
    let mediaUrl = null;
    let resolvedBytes = null;
    if (mediaId) {
      try {
        const resolved = await this.#resolveInboundMediaUrl(
          mediaId,
          connection,
          userId,
          messageType,
        );
        mediaUrl = resolved.url;
        resolvedBytes = resolved.bytes ?? null;
      } catch (err) {
        console.error(
          `[webhook] inbound ${messageType} resolve failed:`,
          err?.message || err,
        );
      }
    }

    // Get sender display name from contacts array in value
    const contacts = value?.contacts ?? [];
    const senderProfile = contacts.find((c) => c.wa_id === fromPhone);
    const displayName = senderProfile?.profile?.name ?? fromPhone;

    // Get or create conversation
    const conversation = await conversationService.getOrCreate(
      userId,
      fromPhone,
      connection._id,
      displayName,
    );

    // Deduplicate: skip if waMessageId already stored
    const existing = await Message.findOne({ waMessageId }).lean();
    if (existing) {
      //debug log
      console.log(`[webhook] duplicate inbound message: ${waMessageId}`);
      return;
    }

    let newMsg;
    try {
      newMsg = await Message.create({
        userId,
        conversationId: conversation._id,
        whatsappConnectionId: connection._id,
        direction: "inbound",
        waMessageId,
        fromPhone,
        content: text,
        messageType,
        mediaUrl,
        fileName: fileName ?? null,
        fileSize: fileSize ?? resolvedBytes ?? null,
        status: MESSAGE_STATUS.DELIVERED,
        deliveredAt: timestamp
          ? new Date(Number(timestamp) * 1000)
          : new Date(),
      });
    } catch (err) {
      if (err && err.code === 11000) {
        console.log(
          `[webhook] duplicate inbound message (race): ${waMessageId}`,
        );
        return;
      }
      throw err;
    }

    const updatedConversation = await conversationService.updateLastMessage(
      conversation._id,
      text,
      "inbound",
    );

    socketEmitter.conversationUpdated(String(userId), {
      conversationId: String(updatedConversation._id),
      lastMessage: updatedConversation.lastMessage,
      lastMessageAt: updatedConversation.lastMessageAt,
      unreadCount: updatedConversation.unreadCount,
    });

    socketEmitter.newMessage(
      String(userId),
      String(updatedConversation._id),
      newMsg,
    );

    await notificationEvents.incomingMessage(
      userId,
      updatedConversation,
      updatedConversation.displayName,
    );

    // debug log
    console.log(
      `[webhook] inbound message stored: from=${fromPhone} waMessageId=${waMessageId}`,
    );
  }

  // ── Delivery status handler ─────────────────────────────────────────────────

  async processStatusEvent(statusEvent) {
    const waMessageId = statusEvent?.id;
    const metaStatus = statusEvent?.status;

    if (!waMessageId || !metaStatus) return WEBHOOK_RESULT.IGNORED;

    const internalStatus = WEBHOOK_STATUS_MAP[metaStatus];

    //debug log
    console.log(
      `[webhook] ${WEBHOOK_MESSAGES.RECEIVED}: waMessageId=${waMessageId} status=${metaStatus}`,
    );

    if (!internalStatus) {
      console.log(
        `[webhook] ${WEBHOOK_MESSAGES.UNKNOWN_STATUS}: ${metaStatus}`,
      );
      return WEBHOOK_RESULT.IGNORED;
    }

    const message = await Message.findOne({ waMessageId })
      .select("_id userId campaignId conversationId status")
      .lean();

    if (!message) {
      //debug log
      console.log(
        `[webhook] ${WEBHOOK_MESSAGES.MESSAGE_NOT_FOUND}: ${waMessageId}`,
      );
      return WEBHOOK_RESULT.IGNORED;
    }

    const changed = await this.updateMessageStatus(
      message.userId,
      message._id,
      internalStatus,
      statusEvent,
    );

    if (!changed) {
      console.log(
        `[webhook] ${WEBHOOK_MESSAGES.EVENT_IGNORED}: waMessageId=${waMessageId} (current=${message.status})`,
      );
      return WEBHOOK_RESULT.IGNORED;
    }

    // Surface the receipt to the chat UI. Only conversation messages have a
    // chat view (campaign messages carry conversationId=null and are handled by
    // the campaign-stats block below). This match is only possible because
    // Phase 1 now persists waMessageId on outbound conversation messages.
    await this.#emitStatusReceipt(
      message.conversationId,
      message._id,
      internalStatus,
    );

    if (message.campaignId) {
      await this.updateCampaignStatistics(message.userId, message.campaignId);
      await this.checkCampaignCompletion(message.userId, message.campaignId);
    }

    // debug log
    console.log(
      `[webhook] ${WEBHOOK_MESSAGES.EVENT_PROCESSED}: waMessageId=${waMessageId} → ${internalStatus}`,
    );
    return WEBHOOK_RESULT.PROCESSED;
  }

  // ── Message status update (idempotent, forward-only) ───────────────────────

  async updateMessageStatus(userId, messageId, targetStatus, statusEvent = {}) {
    const allowedFrom = WEBHOOK_STATUS_TRANSITIONS[targetStatus] || [];
    if (allowedFrom.length === 0) return false;

    const eventTime = statusEvent?.timestamp
      ? new Date(Number(statusEvent.timestamp) * 1000)
      : new Date();

    const tsField = WEBHOOK_STATUS_TIMESTAMP[targetStatus];

    const setStage = {
      status: targetStatus,
    };

    if (tsField) {
      setStage[tsField] = eventTime;
    }

    // A READ implies it was delivered too.
    if (targetStatus === MESSAGE_STATUS.READ && !statusEvent?.deliveredAt) {
      setStage.deliveredAt = eventTime;
    }

    const updated = await Message.findOneAndUpdate(
      { _id: messageId, userId, status: { $in: allowedFrom } },
      { $set: setStage },
      { new: true, projection: { _id: 1 } },
    );

    return Boolean(updated);
  }

  // ── Campaign statistics ─────────────────────────────────────────────────────

  async updateCampaignStatistics(userId, campaignId) {
    const [totalDelivered, totalRead, totalFailed] = await Promise.all([
      Message.countDocuments({
        userId,
        campaignId,
        status: { $in: WEBHOOK_DELIVERED_STATUSES },
      }),
      Message.countDocuments({
        userId,
        campaignId,
        status: MESSAGE_STATUS.READ,
      }),
      Message.countDocuments({
        userId,
        campaignId,
        status: MESSAGE_STATUS.FAILED,
      }),
    ]);

    await Campaign.updateOne(
      { _id: campaignId, userId },
      { $set: { totalDelivered, totalRead, totalFailed } },
    );

    return { totalDelivered, totalRead, totalFailed };
  }

  async checkCampaignCompletion(userId, campaignId) {
    const [total, inFlight] = await Promise.all([
      Message.countDocuments({ userId, campaignId }),
      Message.countDocuments({
        userId,
        campaignId,
        status: { $in: WEBHOOK_IN_FLIGHT_STATUSES },
      }),
    ]);

    if (total === 0 || inFlight > 0) return false;

    const result = await Campaign.updateOne(
      { _id: campaignId, userId, status: CAMPAIGN_STATUS.RUNNING },
      { $set: { status: CAMPAIGN_STATUS.COMPLETED, completedAt: new Date() } },
    );

    if (result.modifiedCount > 0) {
      // Notify the tenant via socket
      const campaign = await Campaign.findById(campaignId).lean();

      if (campaign) {
        socketEmitter.campaignCompleted(String(userId), {
          _id: String(campaignId),
          name: campaign.name,
        });

        notificationEvents.campaignCompleted(userId, campaign);
      }
    }

    return result.modifiedCount > 0;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Emit a delivery/read receipt for a conversation message to that
   * conversation's socket room. Scoped to the room (never a global broadcast),
   * matching the room the client joins via `join_conversation`.
   *
   * Maps the internal status onto the event names the frontend already listens
   * for: DELIVERED → 'message_delivered', READ → 'read_receipt'. Other statuses
   * (and campaign messages, which have no conversationId) emit nothing.
   *
   * Best-effort: a socket failure must never break webhook processing, so it is
   * swallowed and logged.
   */
  async #emitStatusReceipt(conversationId, messageId, internalStatus) {
    if (!conversationId) return;

    socketEmitter.messageStatus(String(conversationId), {
      conversationId: String(conversationId),
      messageId: String(messageId),
      status: internalStatus,
    });
  }

  #extractContent(msg) {
    const type = msg?.type ?? "text";

    switch (type) {
      case "text":
        return { text: msg?.text?.body ?? "", messageType: "text" };
      case "image":
        return {
          text: msg?.image?.caption ?? "[Image]",
          messageType: "image",
          mediaId: msg?.image?.id ?? null,
          fileSize: msg?.image?.file_size ?? null,
        };
      case "audio":
        return {
          text: "[Audio]",
          messageType: "audio",
          mediaId: msg?.audio?.id ?? null,
          fileSize: msg?.audio?.file_size ?? null,
        };
      case "video":
        return {
          text: msg?.video?.caption ?? "[Video]",
          messageType: "video",
          mediaId: msg?.video?.id ?? null,
          fileSize: msg?.video?.file_size ?? null,
        };
      case "document":
        return {
          text: msg?.document?.caption ?? msg?.document?.filename ?? "[Document]",
          messageType: "document",
          mediaId: msg?.document?.id ?? null,
          fileName: msg?.document?.filename ?? null,
          fileSize: msg?.document?.file_size ?? null,
        };
      case "sticker":
        // Stickers are .webp images — Cloudinary stores them as `image`, and
        // the chat UI renders them inline like any other picture.
        return {
          text: "[Sticker]",
          messageType: "sticker",
          mediaId: msg?.sticker?.id ?? null,
          fileSize: msg?.sticker?.file_size ?? null,
        };
      case "location":
        return { text: "[Location]", messageType: "location" };
      default:
        return { text: `[${type}]`, messageType: type };
    }
  }
}

export default new WebhookService();