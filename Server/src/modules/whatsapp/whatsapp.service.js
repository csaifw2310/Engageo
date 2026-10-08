import { exchangeCodeForToken, fetchWABADetails } from "./whatsapp.meta.js";
import WhatsAppConnection from "./whatsapp.model.js";
import ApiError from "../../utils/ApiError.js";
import notificationEvents from "../notifications/notification.events.js";
import {
  CONNECTION_STATUS,
  GRAPH_API_BASE_URL,
  GRAPH_API_TIMEOUT_MS,
  WHATSAPP_MESSAGES,
} from "./whatsapp.constants.js";

/**
 * All methods are tenant-scoped: they take the authenticated `userId` and only
 * ever touch the record owned by that user. There is no code path that lets a
 * tenant read or overwrite another tenant's connection.
 */

class WhatsAppService {
  /**
   * Save connection details after a successful Meta Embedded Signup.
   *
   * One account per tenant: this is an upsert keyed on `userId`, so reconnecting
   * (or connecting a different WABA) updates the existing record in place rather
   * than creating a second one. A fresh access token is stored and status is
   * forced back to "connected".
   */

  async connectAccount(userId, data) {
    const existing = await WhatsAppConnection.findOne({
      phoneNumberId: data.phoneNumberId,
    });

    if (existing && String(existing.userId) !== String(userId)) {
      throw new ApiError(
        409,
        "This WhatsApp Business number is already connected to another workspace.",
      );
    }
    const update = {
      $set: {
        businessAccountId: data.businessAccountId,
        phoneNumberId: data.phoneNumberId,
        phoneNumber: data.phoneNumber,
        businessName: data.businessName,
        accessToken: data.accessToken,
        status: CONNECTION_STATUS.CONNECTED,
        connectedAt: new Date(),
      },
    };

    try {
      const connection = await WhatsAppConnection.findOneAndUpdate(
        { userId },
        update,
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      );

      notificationEvents.whatsappConnected(userId, connection);

      return this.#sanitize(connection);
    } catch (err) {
      // Defensive: a race on the unique userId index surfaces as 11000.
      if (err && err.code === 11000) {
        throw new ApiError(
          409,
          "A WhatsApp account is already connected for this tenant",
        );
      }
      throw err;
    }
  }

  /**
   * Lightweight status lookup. Returns "disconnected" when no record exists so
   * the client always gets a definite answer.
   */
  async getStatus(userId) {
    const connection = await WhatsAppConnection.findOne({ userId })
      .select("status")
      .lean();

    return {
      status: connection ? connection.status : CONNECTION_STATUS.DISCONNECTED,
    };
  }

  /**
   * Full connection details for the authenticated tenant (access token excluded
   * via the model's `select: false`). 404 when nothing is connected.
   */
  async getConnection(userId) {
    const connection = await WhatsAppConnection.findOne({ userId }).lean();
    if (!connection) throw new ApiError(404, WHATSAPP_MESSAGES.NOT_FOUND);
    return connection;
  }

  /**
   * Disconnect: preserve the record for history/auditing, flip status to
   * "disconnected" and strip the stored access token so it can't be reused.
   */
  async disconnectAccount(userId) {
    const connection = await WhatsAppConnection.findOneAndUpdate(
      { userId },
      {
        $set: { status: CONNECTION_STATUS.DISCONNECTED },
        $unset: { accessToken: "" },
      },
      { new: true },
    );

    if (!connection) throw new ApiError(404, WHATSAPP_MESSAGES.NOT_FOUND);

    notificationEvents.whatsappDisconnected(userId, connection);

    return this.#sanitize(connection);
  }

  /**
   * Verify the current connection against Meta's Graph API.
   * Confirms the phone number node is reachable with the stored token, refreshes
   * the cached display name / phone number, and stamps `lastSyncAt`.
   */
  async syncConnection(userId) {
    // Need the token for this one call only — opt in explicitly.
    const connection = await WhatsAppConnection.findOne({ userId }).select(
      "+accessToken",
    );
    if (!connection) throw new ApiError(404, WHATSAPP_MESSAGES.NOT_FOUND);

    if (
      connection.status !== CONNECTION_STATUS.CONNECTED ||
      !connection.accessToken
    ) {
      throw new ApiError(400, WHATSAPP_MESSAGES.NOT_CONNECTED);
    }

    const profile = await this.#verifyPhoneNumber(
      connection.phoneNumberId,
      connection.accessToken,
    );

    // Keep our cached copy fresh with whatever Meta reports.
    if (profile.display_phone_number)
      connection.phoneNumber = profile.display_phone_number;
    if (profile.verified_name) connection.businessName = profile.verified_name;
    connection.lastSyncAt = new Date();

    await connection.save();
    return this.#sanitize(connection);
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Calls GET /{phoneNumberId} on the Graph API to confirm the number and token
   * are valid. Throws an ApiError (502/401) on any non-OK response.
   */
  async #verifyPhoneNumber(phoneNumberId, accessToken) {
    const url = `${GRAPH_API_BASE_URL}/${phoneNumberId}?fields=verified_name,display_phone_number,id`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GRAPH_API_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
    } catch (err) {
      throw new ApiError(
        502,
        `${WHATSAPP_MESSAGES.VERIFY_FAILED}: ${err.message}`,
      );
    } finally {
      clearTimeout(timeout);
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const metaMessage = payload?.error?.message || `HTTP ${response.status}`;
      const statusCode =
        response.status === 401 || response.status === 403 ? 401 : 502;
      throw new ApiError(
        statusCode,
        `${WHATSAPP_MESSAGES.VERIFY_FAILED}: ${metaMessage}`,
      );
    }

    return payload;
  }

  async exchangeCode(userId, code) {
    const accessToken = await exchangeCodeForToken(code);
    const wabaDetails = await fetchWABADetails(accessToken);

    return this.connectAccount(userId, { ...wabaDetails, accessToken });
  }

  /** Strip the access token before a document ever leaves the service layer. */
  #sanitize(doc) {
    const obj =
      typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
    delete obj.accessToken;
    return obj;
  }
}

export default new WhatsAppService();
