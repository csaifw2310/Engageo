import notificationService from "./notification.service.js";
import settingsRepository from "../settings/settings.repository.js";
import {
  NOTIFICATION_TYPE,
  NOTIFICATION_EVENT,
  NOTIFICATION_PRIORITY,
} from "./notification.constants.js";
import {
  truncate,
  formatCurrency,
  pluralize,
  displayName,
} from "./notification.helpers.js";

/**
 * NotificationEvents — the ONLY surface other modules should touch.
 *
 * Every existing service (campaign, whatsapp, payment, subscription, webhook,
 * contacts) calls exactly one method here instead of importing
 * notification.service.js or the socket layer directly. This keeps:
 *
 *   • the persisted copy (title/message) centralised and easy to audit
 *   • the "should this even be sent" preference gate in one place — reusing
 *     the notification toggles that already live on UserSettings
 *     (campaignCompleted, campaignFailed, paymentAlerts, subscriptionAlerts)
 *   • callers trivially simple: `notificationEvents.campaignCompleted(userId, campaign)`
 *
 * A failure to raise a notification NEVER throws back into the caller — a
 * campaign launch or a payment webhook must succeed even if, say, Mongo is
 * briefly unavailable for the notification write. Errors are swallowed after
 * being surfaced to the console for visibility.
 */
class NotificationEvents {
  // ── Campaign lifecycle ───────────────────────────────────────────────────

  async campaignCreated(userId, campaign) {
    await this.#emit(userId, {
      type: NOTIFICATION_TYPE.CAMPAIGN,
      event: NOTIFICATION_EVENT.CAMPAIGN_CREATED,
      title: "Campaign created",
      message: `"${truncate(displayName(campaign, "Untitled campaign"))}" was created as a draft.`,
      metadata: { campaignId: String(campaign._id), name: campaign.name },
    });
  }

  async campaignStarted(userId, campaign) {
    await this.#emit(userId, {
      type: NOTIFICATION_TYPE.CAMPAIGN,
      event: NOTIFICATION_EVENT.CAMPAIGN_STARTED,
      title: "Campaign started",
      message: `"${truncate(displayName(campaign, "Untitled campaign"))}" has started sending to ${pluralize(
        campaign.totalRecipients || 0,
        "recipient",
      )}.`,
      metadata: { campaignId: String(campaign._id), name: campaign.name },
    });
  }

  async campaignCompleted(userId, campaign) {
    const allowed = await this.#isEnabled(userId, "campaignCompleted");
    if (!allowed) return;

    await this.#emit(userId, {
      type: NOTIFICATION_TYPE.CAMPAIGN,
      event: NOTIFICATION_EVENT.CAMPAIGN_COMPLETED,
      title: "Campaign completed",
      message: `"${truncate(displayName(campaign, "Untitled campaign"))}" has finished sending.`,
      metadata: { campaignId: String(campaign._id), name: campaign.name },
    });
  }

  async campaignFailed(userId, campaign, reason) {
    const allowed = await this.#isEnabled(userId, "campaignFailed");
    if (!allowed) return;

    await this.#emit(userId, {
      type: NOTIFICATION_TYPE.CAMPAIGN,
      event: NOTIFICATION_EVENT.CAMPAIGN_FAILED,
      title: "Campaign failed",
      priority: NOTIFICATION_PRIORITY.HIGH,
      message: reason
        ? `"${truncate(displayName(campaign, "Untitled campaign"))}" failed: ${truncate(reason, 120)}`
        : `"${truncate(displayName(campaign, "Untitled campaign"))}" encountered an error and could not complete.`,
      metadata: { campaignId: String(campaign._id), name: campaign.name },
    });
  }

  // ── WhatsApp connection ──────────────────────────────────────────────────

  async whatsappConnected(userId, connection) {
    await this.#emit(userId, {
      type: NOTIFICATION_TYPE.WHATSAPP,
      event: NOTIFICATION_EVENT.WHATSAPP_CONNECTED,
      title: "WhatsApp connected",
      message: connection?.phoneNumber
        ? `Your WhatsApp number ${connection.phoneNumber} is now connected.`
        : "Your WhatsApp Business account is now connected.",
      metadata: { connectionId: String(connection._id) },
    });
  }

  async whatsappDisconnected(userId, connection) {
    await this.#emit(userId, {
      type: NOTIFICATION_TYPE.WHATSAPP,
      event: NOTIFICATION_EVENT.WHATSAPP_DISCONNECTED,
      title: "WhatsApp disconnected",
      priority: NOTIFICATION_PRIORITY.HIGH,
      message:
        "Your WhatsApp Business account has been disconnected. Campaigns cannot send until you reconnect.",
      metadata: { connectionId: String(connection._id) },
    });
  }

  // ── Contacts ─────────────────────────────────────────────────────────────

  async contactImportCompleted(userId, result) {
    const { importedCount = 0, skippedCount = 0 } = result || {};
    await this.#emit(userId, {
      type: NOTIFICATION_TYPE.CONTACT,
      event: NOTIFICATION_EVENT.CONTACT_IMPORT_COMPLETED,
      title: "Contact import completed",
      message:
        skippedCount > 0
          ? `Imported ${pluralize(importedCount, "contact")}, skipped ${skippedCount}.`
          : `Imported ${pluralize(importedCount, "contact")} successfully.`,
      metadata: { importedCount, skippedCount },
    });
  }

  // ── Billing: payments ────────────────────────────────────────────────────

  async paymentSuccess(userId, payment) {
    const allowed = await this.#isEnabled(userId, "paymentAlerts");
    if (!allowed) return;

    await this.#emit(userId, {
      type: NOTIFICATION_TYPE.BILLING,
      event: NOTIFICATION_EVENT.PAYMENT_SUCCESS,
      title: "Payment successful",
      message: `Your payment of ${formatCurrency(payment.amount, payment.currency)} was successful.`,
      metadata: {
        paymentId: String(payment._id),
        amount: payment.amount,
        currency: payment.currency,
      },
    });
  }

  async paymentFailed(userId, payment) {
    const allowed = await this.#isEnabled(userId, "paymentAlerts");
    if (!allowed) return;

    await this.#emit(userId, {
      type: NOTIFICATION_TYPE.BILLING,
      event: NOTIFICATION_EVENT.PAYMENT_FAILED,
      title: "Payment failed",
      priority: NOTIFICATION_PRIORITY.HIGH,
      message: `Your payment of ${formatCurrency(payment.amount, payment.currency)} could not be processed.`,
      metadata: {
        paymentId: String(payment._id),
        amount: payment.amount,
        currency: payment.currency,
      },
    });
  }

  // ── Billing: subscriptions ───────────────────────────────────────────────

  async subscriptionActivated(userId, subscription, plan) {
    const allowed = await this.#isEnabled(userId, "subscriptionAlerts");
    if (!allowed) return;

    await this.#emit(userId, {
      type: NOTIFICATION_TYPE.BILLING,
      event: NOTIFICATION_EVENT.SUBSCRIPTION_ACTIVATED,
      title: "Subscription activated",
      message: `You're now on the ${displayName(plan, "selected")} plan.`,
      metadata: {
        subscriptionId: String(subscription._id),
        planId: plan?._id ? String(plan._id) : null,
      },
    });
  }

  async subscriptionCancelled(userId, subscription) {
    const allowed = await this.#isEnabled(userId, "subscriptionAlerts");
    if (!allowed) return;

    await this.#emit(userId, {
      type: NOTIFICATION_TYPE.BILLING,
      event: NOTIFICATION_EVENT.SUBSCRIPTION_CANCELLED,
      title: "Subscription cancelled",
      message:
        "Auto-renew has been turned off. You will retain access until the end of the current period.",
      metadata: { subscriptionId: String(subscription._id) },
    });
  }

  async subscriptionExpiring(userId, subscription, daysRemaining) {
    const allowed = await this.#isEnabled(userId, "subscriptionAlerts");
    if (!allowed) return;

    await this.#emit(userId, {
      type: NOTIFICATION_TYPE.BILLING,
      event: NOTIFICATION_EVENT.SUBSCRIPTION_EXPIRING,
      title: "Subscription expiring soon",
      priority: NOTIFICATION_PRIORITY.HIGH,
      message: `Your subscription expires in ${pluralize(daysRemaining, "day")}. Renew to avoid losing access.`,
      metadata: { subscriptionId: String(subscription._id), daysRemaining },
    });
  }

  // ── System ───────────────────────────────────────────────────────────────

  async systemAlert(userId, { title, message, priority, metadata } = {}) {
    await this.#emit(userId, {
      type: NOTIFICATION_TYPE.SYSTEM,
      event: NOTIFICATION_EVENT.SYSTEM_ALERT,
      title: title || "System alert",
      priority: priority || NOTIFICATION_PRIORITY.NORMAL,
      message:
        message || "There is an important update regarding your account.",
      metadata: metadata || {},
    });
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  /** Check a boolean toggle on UserSettings.notifications; defaults to allowed. */
  async #isEnabled(userId, preferenceKey) {
    try {
      const settings = await settingsRepository.findOrCreate(userId);
      const prefs = settings?.notifications || {};
      return prefs[preferenceKey] !== false;
    } catch {
      // If settings can't be read, fail open — better to over-notify than
      // silently drop something like a failed payment.
      return true;
    }
  }

  /** Create + real-time-emit, swallowing any error so callers never break. */
  async #emit(userId, payload) {
    try {
      await notificationService.create(userId, payload);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `[notification.events] failed to raise "${payload.event}":`,
        err.message,
      );
    }
  }

  //  whatsapp incoming message notification
  async incomingMessage(userId, conversation, senderName) {
    const allowed = await this.#isEnabled(userId, "incomingMessages");
    if (!allowed) return;

    await this.#emit(userId, {
      type: NOTIFICATION_TYPE.WHATSAPP,
      event: NOTIFICATION_EVENT.INCOMING_MESSAGE,
      title: "New WhatsApp message",
      message: `${senderName || "Unknown"} sent you a message.`,
      metadata: {
        conversationId: String(conversation._id),
        phoneNumber: conversation.phoneNumber,
      },
    });
  }
}

export default new NotificationEvents();
