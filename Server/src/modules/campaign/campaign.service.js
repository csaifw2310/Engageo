import Campaign from './campaign.model.js';
import Template from '../templates/template.model.js';
import notificationEvents from '../notifications/notification.events.js';
import Group from '../contacts/groups/group.model.js';
import Membership from '../contacts/memberships/membership.model.js';
import WhatsAppConnection from '../whatsapp/whatsapp.model.js';
import ApiError from '../../utils/ApiError.js';
import { CONNECTION_STATUS } from '../whatsapp/whatsapp.constants.js';
import {
  CAMPAIGN_STATUS,
  CAMPAIGN_PAGINATION,
  CAMPAIGN_UPDATABLE_STATUSES,
  CAMPAIGN_DELETABLE_STATUSES,
  CAMPAIGN_CANCELLABLE_STATUSES,
  CAMPAIGN_SCHEDULABLE_STATUSES,
  CAMPAIGN_LAUNCHABLE_STATUSES,
  CAMPAIGN_MESSAGES,
} from './campaign.constants.js';

// Escape user input before using it inside a RegExp (prevents ReDoS / injection).
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// De-duplicate an array of ObjectId-like values to their string form.
const uniqueIds = (ids = []) => [...new Set(ids.map((id) => String(id)))];

/**
 * Campaign lifecycle service.
 *
 * Every method is tenant-scoped: it takes the authenticated `userId` and only
 * ever reads or writes documents owned by that user. There is no code path that
 * can reach another tenant's campaigns, templates, groups or connection.
 *
 * This service deliberately contains NO WhatsApp / Graph API calls. It only
 * creates and transitions campaign documents. Actual message delivery is the
 * Messaging module's responsibility.
 */
class CampaignService {
  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Create a DRAFT campaign for a tenant.
   *
   * Validates (all tenant-scoped):
   *   • the template exists and belongs to the user
   *   • every group exists and belongs to the user
   *   • the user has a WhatsApp connection (resolved automatically)
   *
   * The campaign is always created as DRAFT regardless of whether `scheduledAt`
   * was supplied — moving to SCHEDULED is an explicit action (POST .../schedule).
   * `totalRecipients` is snapshotted from the unique contacts across the groups.
   */
  async createCampaign(userId, data) {
    const groupIds = uniqueIds(data.groupIds);

    // Ownership / existence checks run in parallel.
    const [, , connection, totalRecipients] = await Promise.all([
      this.#assertTemplateOwned(userId, data.templateId),
      this.#assertGroupsOwned(userId, groupIds),
      this.#resolveConnection(userId),
      this.#countRecipients(userId, groupIds),
    ]);

    // If a scheduledAt is supplied at create time, keep it (validated future by
    // the validator) but DO NOT promote out of DRAFT — that is an explicit step.
    const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;

    try {
      const campaign = await Campaign.create({
        userId,
        whatsappConnectionId: connection._id,
        templateId: data.templateId,
        groupIds,
        name: data.name,
        description: data.description || '',
        scheduledAt,
        status: CAMPAIGN_STATUS.DRAFT,
        totalRecipients,
      });

      notificationEvents.campaignCreated(userId, campaign);

      return campaign;
    } catch (err) {
      if (err && err.code === 11000) {
        throw new ApiError(409, CAMPAIGN_MESSAGES.DUPLICATE_NAME);
      }
      throw err;
    }
  }

  /**
   * List a tenant's campaigns with search + status filter + pagination.
   * Returns the project's standard list envelope.
   */
  async listCampaigns(userId, options = {}) {
    const page = Math.max(
      parseInt(options.page, 10) || CAMPAIGN_PAGINATION.DEFAULT_PAGE,
      1
    );
    const limit = Math.min(
      Math.max(parseInt(options.limit, 10) || CAMPAIGN_PAGINATION.DEFAULT_LIMIT, 1),
      CAMPAIGN_PAGINATION.MAX_LIMIT
    );
    const skip = (page - 1) * limit;

    // Tenant scope is ALWAYS applied first.
    const filter = { userId };

    if (options.status) filter.status = options.status;

    if (options.search) {
      const rx = new RegExp(escapeRegex(options.search.trim()), 'i');
      filter.$or = [{ name: rx }, { description: rx }];
    }

    const [campaigns, totalCampaigns] = await Promise.all([
      Campaign.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Campaign.countDocuments(filter),
    ]);

    return {
      campaigns,
      totalCampaigns,
      totalPages: Math.ceil(totalCampaigns / limit) || 0,
      currentPage: page,
    };
  }

  /** Fetch a single owned campaign (404 if not found OR not owned). */
  async getCampaign(userId, id) {
    const campaign = await Campaign.findOne({ _id: id, userId }).lean();
    if (!campaign) throw new ApiError(404, CAMPAIGN_MESSAGES.NOT_FOUND);
    return campaign;
  }

  /**
   * Update an owned campaign. Allowed only while DRAFT or SCHEDULED.
   *
   * Mutable fields: name, description, templateId, groupIds, scheduledAt.
   * Status and the delivery counters are NOT mutable here — status moves only
   * through the dedicated lifecycle endpoints, and counters are owned by the
   * Messaging module.
   */
  async updateCampaign(userId, id, data) {
    const campaign = await Campaign.findOne({ _id: id, userId });
    if (!campaign) throw new ApiError(404, CAMPAIGN_MESSAGES.NOT_FOUND);

    if (!CAMPAIGN_UPDATABLE_STATUSES.includes(campaign.status)) {
      throw new ApiError(409, CAMPAIGN_MESSAGES.NOT_UPDATABLE);
    }

    // Re-validate any references that are being changed, then apply.
    if (data.templateId !== undefined) {
      await this.#assertTemplateOwned(userId, data.templateId);
      campaign.templateId = data.templateId;
    }

    if (data.groupIds !== undefined) {
      const groupIds = uniqueIds(data.groupIds);
      await this.#assertGroupsOwned(userId, groupIds);
      campaign.groupIds = groupIds;
      // Recipient snapshot follows the group set.
      campaign.totalRecipients = await this.#countRecipients(userId, groupIds);
    }

    if (data.name !== undefined) campaign.name = data.name;
    if (data.description !== undefined) campaign.description = data.description;
    if (data.scheduledAt !== undefined) {
      campaign.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
    }

    try {
      await campaign.save();
      return campaign;
    } catch (err) {
      if (err && err.code === 11000) {
        throw new ApiError(409, CAMPAIGN_MESSAGES.DUPLICATE_NAME);
      }
      throw err;
    }
  }

  /** Delete an owned campaign. Allowed only while DRAFT or CANCELLED. */
  async deleteCampaign(userId, id) {
    const campaign = await Campaign.findOne({ _id: id, userId });
    if (!campaign) throw new ApiError(404, CAMPAIGN_MESSAGES.NOT_FOUND);

    if (!CAMPAIGN_DELETABLE_STATUSES.includes(campaign.status)) {
      throw new ApiError(409, CAMPAIGN_MESSAGES.NOT_DELETABLE);
    }

    await campaign.deleteOne();
    return campaign;
  }

  /**
   * Schedule an owned campaign for a future datetime.
   * Allowed from DRAFT or SCHEDULED (re-scheduling). Status → SCHEDULED.
   *
   * The campaign must be launch-ready (connection connected, template still
   * owned, at least one recipient) so we never schedule something that can
   * never run when its time arrives.
   */
  async scheduleCampaign(userId, id, scheduledAt) {
    const campaign = await Campaign.findOne({ _id: id, userId });
    if (!campaign) throw new ApiError(404, CAMPAIGN_MESSAGES.NOT_FOUND);

    if (!CAMPAIGN_SCHEDULABLE_STATUSES.includes(campaign.status)) {
      throw new ApiError(409, CAMPAIGN_MESSAGES.NOT_SCHEDULABLE);
    }

    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      throw new ApiError(400, CAMPAIGN_MESSAGES.SCHEDULE_IN_PAST);
    }

    await this.#assertLaunchReady(userId, campaign);

    campaign.scheduledAt = when;
    campaign.status = CAMPAIGN_STATUS.SCHEDULED;
    await campaign.save();
    return campaign;
  }

  /**
   * Launch an owned campaign immediately. Allowed from DRAFT or SCHEDULED.
   * Status → RUNNING, launchedAt stamped.
   *
   * Readiness requirements: WhatsApp connected, template still owned, and at
   * least one recipient. NOTE: this does NOT send any messages — it only flips
   * the state. The Messaging module processes RUNNING campaigns separately.
   */
  async launchCampaign(userId, id) {
    const campaign = await Campaign.findOne({ _id: id, userId });
    if (!campaign) throw new ApiError(404, CAMPAIGN_MESSAGES.NOT_FOUND);

    if (!CAMPAIGN_LAUNCHABLE_STATUSES.includes(campaign.status)) {
      throw new ApiError(409, CAMPAIGN_MESSAGES.NOT_LAUNCHABLE);
    }

    const { totalRecipients } = await this.#assertLaunchReady(userId, campaign);

    // Refresh the recipient snapshot at the moment of launch.
    campaign.totalRecipients = totalRecipients;
    campaign.status = CAMPAIGN_STATUS.RUNNING;
    campaign.launchedAt = new Date();
    await campaign.save();

    notificationEvents.campaignStarted(userId, campaign);

    return campaign;
  }

  /** Cancel an owned campaign. Allowed from DRAFT or SCHEDULED. Status → CANCELLED. */
  async cancelCampaign(userId, id) {
    const campaign = await Campaign.findOne({ _id: id, userId });
    if (!campaign) throw new ApiError(404, CAMPAIGN_MESSAGES.NOT_FOUND);

    if (!CAMPAIGN_CANCELLABLE_STATUSES.includes(campaign.status)) {
      throw new ApiError(409, CAMPAIGN_MESSAGES.NOT_CANCELLABLE);
    }

    campaign.status = CAMPAIGN_STATUS.CANCELLED;
    await campaign.save();
    return campaign;
  }

  // ── Internal helpers (all tenant-scoped) ────────────────────────────────────

  /** Ensure the template exists AND belongs to the tenant. */
  async #assertTemplateOwned(userId, templateId) {
    const template = await Template.findOne({ _id: templateId, userId })
      .select('_id')
      .lean();
    if (!template) throw new ApiError(404, CAMPAIGN_MESSAGES.TEMPLATE_NOT_FOUND);
    return template;
  }

  /**
   * Ensure EVERY supplied group exists AND belongs to the tenant. Rejects if
   * any id is missing — partial ownership is treated as a failure so a campaign
   * can never silently target fewer groups than requested.
   */
  async #assertGroupsOwned(userId, groupIds) {
    if (!Array.isArray(groupIds) || groupIds.length === 0) {
      throw new ApiError(404, CAMPAIGN_MESSAGES.GROUPS_NOT_FOUND);
    }

    const owned = await Group.find({ _id: { $in: groupIds }, userId })
      .select('_id')
      .lean();

    if (owned.length !== uniqueIds(groupIds).length) {
      throw new ApiError(404, CAMPAIGN_MESSAGES.GROUPS_NOT_FOUND);
    }
    return owned;
  }

  /** Resolve the tenant's single WhatsApp connection (404 if none). */
  async #resolveConnection(userId) {
    const connection = await WhatsAppConnection.findOne({ userId }).select(
      '_id status'
    );
    if (!connection) throw new ApiError(404, CAMPAIGN_MESSAGES.CONNECTION_NOT_FOUND);
    return connection;
  }

  /**
   * Count the unique contacts across a set of the tenant's groups — the number
   * of recipients a broadcast to those groups would reach. A contact in two of
   * the campaign's groups is counted once.
   */
  async #countRecipients(userId, groupIds) {
    if (!Array.isArray(groupIds) || groupIds.length === 0) return 0;
    const contactIds = await Membership.distinct('contactId', {
      userId,
      groupId: { $in: groupIds },
    });
    return contactIds.length;
  }

  /**
   * Shared launch-readiness gate used by both schedule() and launch():
   *   • the tenant's WhatsApp connection exists and is CONNECTED
   *   • the campaign's template still exists and is owned
   *   • the campaign reaches at least one recipient
   * Returns { totalRecipients } so callers can reuse the count.
   */
  async #assertLaunchReady(userId, campaign) {
    const connection = await this.#resolveConnection(userId);
    if (connection.status !== CONNECTION_STATUS.CONNECTED) {
      throw new ApiError(400, CAMPAIGN_MESSAGES.CONNECTION_NOT_CONNECTED);
    }

    await this.#assertTemplateOwned(userId, campaign.templateId);

    const totalRecipients = await this.#countRecipients(userId, campaign.groupIds);
    if (totalRecipients < 1) {
      throw new ApiError(400, CAMPAIGN_MESSAGES.NO_RECIPIENTS);
    }

    return { totalRecipients };
  }
}

export default new CampaignService();
