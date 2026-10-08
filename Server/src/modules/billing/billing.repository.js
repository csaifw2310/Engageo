import Contact from '../contacts/contact/contact.model.js';
import Campaign from '../campaign/campaign.model.js';
import Message from '../message/message.model.js';

import { USAGE_RESOURCE } from './billing.constants.js';

/**
 * Billing usage data-access layer (Repository Pattern).
 *
 * The single place billing reads the metered collections owned by other
 * modules (Contacts, Campaigns, Messaging). Keeping these reads here means the
 * billing service and the usage middleware never import another module's model
 * directly, and the "what counts against a limit" rules live in exactly one
 * place.
 *
 * Every method is tenant-scoped. The two monthly metrics count documents
 * created since the first instant of the current calendar month (server time),
 * matching the per-month plan limits.
 */
class BillingRepository {
  /** First instant of the current calendar month. */
  #startOfMonth(now = new Date()) {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  /** Total contacts the tenant owns (lifetime — contacts are not per-month). */
  async countContacts(userId) {
    return Contact.countDocuments({ userId });
  }

  /** Campaigns the tenant created this calendar month. */
  async countCampaignsThisMonth(userId, now = new Date()) {
    return Campaign.countDocuments({
      userId,
      createdAt: { $gte: this.#startOfMonth(now) },
    });
  }

  /** Messages the tenant created this calendar month. */
  async countMessagesThisMonth(userId, now = new Date()) {
    return Message.countDocuments({
      userId,
      createdAt: { $gte: this.#startOfMonth(now) },
    });
  }

  /**
   * Current usage for a single metered resource — the cheap path used by the
   * usage middleware, which only needs the one number it is gating on.
   *
   * @param {string} resource A USAGE_RESOURCE value.
   * @returns {Promise<number>}
   */
  async countForResource(userId, resource) {
    switch (resource) {
      case USAGE_RESOURCE.CONTACT:
        return this.countContacts(userId);
      case USAGE_RESOURCE.CAMPAIGN:
        return this.countCampaignsThisMonth(userId);
      case USAGE_RESOURCE.MESSAGE:
        return this.countMessagesThisMonth(userId);
      default:
        return 0;
    }
  }

  /**
   * All three usage figures at once (the billing-summary path), counted in
   * parallel. Returns { contactsUsed, campaignsUsed, messagesUsed }.
   */
  async usageSnapshot(userId) {
    const now = new Date();
    const [contactsUsed, campaignsUsed, messagesUsed] = await Promise.all([
      this.countContacts(userId),
      this.countCampaignsThisMonth(userId, now),
      this.countMessagesThisMonth(userId, now),
    ]);
    return { contactsUsed, campaignsUsed, messagesUsed };
  }
}

export default new BillingRepository();
