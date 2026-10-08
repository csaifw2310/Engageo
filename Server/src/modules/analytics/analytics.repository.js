import mongoose from 'mongoose';

import Campaign from '../campaign/campaign.model.js';
import Message from '../message/message.model.js';
import Contact from '../contacts/contact/contact.model.js';
import Group from '../contacts/groups/group.model.js';
import Membership from '../contacts/memberships/membership.model.js';

import {
  MESSAGE_STATUS,
  MESSAGE_SENT_STATUSES,
  ANALYTICS_DELIVERED_STATUSES,
  CONTACT_STATUS,
  ANALYTICS_TREND_TIMEZONE,
} from './analytics.constants.js';

/**
 * Analytics data-access layer (Repository Pattern).
 *
 * This is the ONLY layer in the Analytics module that talks to MongoDB. It
 * returns raw counts and grouped figures; turning those into rates, envelopes
 * and zero-filled series is the Service layer's job. Keeping every pipeline in
 * one place means the aggregation logic can be reasoned about (and indexed) in
 * isolation from the orchestration above it.
 *
 * Hard rules honoured by every method here:
 *   • READ-ONLY. No method ever writes, updates or deletes.
 *   • TENANT-SCOPED. Every pipeline begins with a `{ userId }` match (and every
 *     $lookup sub-pipeline re-asserts the same userId), so a tenant can never
 *     observe another tenant's data.
 *   • PUSH WORK TO MONGO. Grouping, counting and bucketing happen inside the
 *     database; large document sets are never pulled into Node memory.
 *
 * Collection names for $lookup are read from the models (e.g.
 * `Message.collection.name`) rather than hard-coded, so a model whose collection
 * is not the naive pluralisation (GroupMembership → "groupmemberships") can
 * never be looked up against the wrong collection.
 */
class AnalyticsRepository {
  // ── Shared helpers ──────────────────────────────────────────────────────────

  /** Coerce a tenant id string into an ObjectId for use inside aggregations. */
  #oid(userId) {
    return new mongoose.Types.ObjectId(String(userId));
  }

  /**
   * Per-campaign delivery rollup, computed by COUNTING messages (never trusting
   * the cached campaign counters) — exactly how the Webhook module recomputes
   * its statistics, so analytics and stored counters always agree.
   *
   * Returns the $lookup + $addFields stages that decorate each Campaign doc in
   * an aggregation with: totalMessages, totalSent, totalDelivered, totalRead,
   * totalFailed, plus the raw (un-rounded) readRate / deliveryRate used purely
   * as sort keys. Shared by the campaign-list and top-campaigns pipelines.
   */
  #campaignMetricStages(userId) {
    return [
      {
        $lookup: {
          from: Message.collection.name,
          let: { campaignId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$campaignId', '$$campaignId'] },
                    // Re-assert tenant scope inside the join.
                    { $eq: ['$userId', this.#oid(userId)] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                totalMessages: { $sum: 1 },
                totalSent: {
                  $sum: {
                    $cond: [{ $in: ['$status', MESSAGE_SENT_STATUSES] }, 1, 0],
                  },
                },
                totalDelivered: {
                  $sum: {
                    $cond: [
                      { $in: ['$status', ANALYTICS_DELIVERED_STATUSES] },
                      1,
                      0,
                    ],
                  },
                },
                totalRead: {
                  $sum: {
                    $cond: [{ $eq: ['$status', MESSAGE_STATUS.READ] }, 1, 0],
                  },
                },
                totalFailed: {
                  $sum: {
                    $cond: [{ $eq: ['$status', MESSAGE_STATUS.FAILED] }, 1, 0],
                  },
                },
              },
            },
          ],
          as: 'metrics',
        },
      },
      // Flatten the single grouped row (or default everything to 0 when the
      // campaign has no messages yet).
      {
        $addFields: {
          totalMessages: { $ifNull: [{ $first: '$metrics.totalMessages' }, 0] },
          totalSent: { $ifNull: [{ $first: '$metrics.totalSent' }, 0] },
          totalDelivered: {
            $ifNull: [{ $first: '$metrics.totalDelivered' }, 0],
          },
          totalRead: { $ifNull: [{ $first: '$metrics.totalRead' }, 0] },
          totalFailed: { $ifNull: [{ $first: '$metrics.totalFailed' }, 0] },
        },
      },
      // Raw rates used only for sorting (Service re-rounds for the response).
      {
        $addFields: {
          _readRate: {
            $cond: [
              { $gt: ['$totalDelivered', 0] },
              { $divide: ['$totalRead', '$totalDelivered'] },
              0,
            ],
          },
          _deliveryRate: {
            $cond: [
              { $gt: ['$totalSent', 0] },
              { $divide: ['$totalDelivered', '$totalSent'] },
              0,
            ],
          },
        },
      },
      { $project: { metrics: 0 } },
    ];
  }

  // ── Top-level counts ────────────────────────────────────────────────────────

  /**
   * Cheap, index-backed document counts for the dashboard header.
   * Returns { totalContacts, totalGroups, totalCampaigns, totalMessages }.
   */
  async countCollections(userId) {
    const [totalContacts, totalGroups, totalCampaigns, totalMessages] =
      await Promise.all([
        Contact.countDocuments({ userId }),
        Group.countDocuments({ userId }),
        Campaign.countDocuments({ userId }),
        Message.countDocuments({ userId }),
      ]);

    return { totalContacts, totalGroups, totalCampaigns, totalMessages };
  }

  // ── Message status breakdown ────────────────────────────────────────────────

  /**
   * Count a tenant's messages grouped by exact status, optionally scoped to a
   * single campaign. Returns a plain object keyed by MESSAGE_STATUS with a
   * count for every status (missing statuses default to 0):
   *   { PENDING, QUEUED, SENT, DELIVERED, READ, FAILED }
   *
   * One grouped aggregation — never loads documents into memory.
   */
  async messageStatusBreakdown(userId, campaignId = null) {
    const match = { userId: this.#oid(userId) };
    if (campaignId) match.campaignId = this.#oid(campaignId);

    const rows = await Message.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Seed every known status at 0 so callers never have to null-check.
    const breakdown = Object.values(MESSAGE_STATUS).reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {});

    for (const row of rows) {
      if (row._id in breakdown) breakdown[row._id] = row.count;
    }

    return breakdown;
  }

  // ── Campaign analytics (paginated list) ─────────────────────────────────────

  /** Total number of a tenant's campaigns (for the pagination envelope). */
  async countCampaigns(userId) {
    return Campaign.countDocuments({ userId });
  }

  /**
   * One page of campaigns, each decorated with its delivery metrics and ordered
   * by `sortStage` (a $sort spec built by the Service). Sorting happens AFTER
   * the metric stages so best/worst-performing can sort on the computed rates.
   * Pagination is applied inside the pipeline ($skip/$limit) so only the page is
   * ever returned.
   */
  async campaignMetricsPage(userId, { skip, limit, sort }) {
    return Campaign.aggregate([
      { $match: { userId: this.#oid(userId) } },
      ...this.#campaignMetricStages(userId),
      { $sort: sort },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          name: 1,
          status: 1,
          totalRecipients: 1,
          totalSent: 1,
          totalDelivered: 1,
          totalRead: 1,
          totalFailed: 1,
        },
      },
    ]);
  }

  // ── Single campaign analytics ───────────────────────────────────────────────

  /**
   * Fetch one campaign scoped to the tenant (lean). Returns null when the
   * campaign does not exist OR does not belong to the tenant — the Service turns
   * that into a 404. No metrics here; the Service pairs this with
   * messageStatusBreakdown(userId, campaignId).
   */
  async findCampaign(userId, campaignId) {
    return Campaign.findOne({ _id: campaignId, userId }).lean();
  }

  // ── Contact analytics ─────────────────────────────────────────────────────

  /**
   * Count a tenant's contacts grouped by status. Returns
   * { total, active, inactive } with a single grouped aggregation.
   */
  async contactStatusBreakdown(userId) {
    const rows = await Contact.aggregate([
      { $match: { userId: this.#oid(userId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    let total = 0;
    let active = 0;
    let inactive = 0;

    for (const row of rows) {
      total += row.count;
      if (row._id === CONTACT_STATUS.ACTIVE) active = row.count;
      else if (row._id === CONTACT_STATUS.INACTIVE) inactive = row.count;
    }

    return { total, active, inactive };
  }

  // ── Group analytics ─────────────────────────────────────────────────────────

  /** Total number of a tenant's groups. */
  async countGroups(userId) {
    return Group.countDocuments({ userId });
  }

  /**
   * Membership-derived group sizing for the tenant. Counts memberships per group
   * (a membership is unique per contact+group, so this is the contact count),
   * then returns the grand total of memberships and the single largest group
   * (with its name resolved via a tenant-scoped $lookup).
   *
   * Returns { totalMemberships, largestGroup } where largestGroup is
   * { id, name, contactCount } or null when the tenant has no memberships.
   */
  async groupSizing(userId) {
    const [totalsRow] = await Membership.aggregate([
      { $match: { userId: this.#oid(userId) } },
      { $count: 'totalMemberships' },
    ]);
    const totalMemberships = totalsRow?.totalMemberships || 0;

    const [largest] = await Membership.aggregate([
      { $match: { userId: this.#oid(userId) } },
      { $group: { _id: '$groupId', contactCount: { $sum: 1 } } },
      { $sort: { contactCount: -1, _id: 1 } },
      { $limit: 1 },
      {
        $lookup: {
          from: Group.collection.name,
          let: { groupId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$groupId'] },
                    { $eq: ['$userId', this.#oid(userId)] },
                  ],
                },
              },
            },
            { $project: { name: 1 } },
          ],
          as: 'group',
        },
      },
      { $match: { group: { $ne: [] } } },
      {
        $project: {
          _id: 0,
          id: '$_id',
          name: { $first: '$group.name' },
          contactCount: 1,
        },
      },
    ]);

    return { totalMemberships, largestGroup: largest || null };
  }

  // ── Trends ────────────────────────────────────────────────────────────────

  /**
   * Daily counts for a single date field, from `start` (inclusive) onward,
   * bucketed by calendar day in UTC. Generic so the Service can reuse it for
   * campaigns-by-createdAt, messages-by-createdAt, delivered-by-deliveredAt and
   * read-by-readAt.
   *
   * Returns a Map<"YYYY-MM-DD", count>. The Service is responsible for
   * scaffolding the full range and zero-filling missing days.
   */
  async #dailyCounts(Model, userId, dateField, start) {
    const rows = await Model.aggregate([
      {
        $match: {
          userId: this.#oid(userId),
          [dateField]: { $gte: start },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: `$${dateField}`,
              timezone: ANALYTICS_TREND_TIMEZONE,
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    return new Map(rows.map((r) => [r._id, r.count]));
  }

  /**
   * All four daily series for the trends endpoint, computed in parallel:
   *   • campaigns  — Campaign.createdAt
   *   • messages   — Message.createdAt
   *   • delivered  — Message.deliveredAt
   *   • read       — Message.readAt
   * Each is a Map<dateString, count>; the Service merges them onto a zero-filled
   * date scaffold.
   */
  async dailyTrendSeries(userId, start) {
    const [campaigns, messages, delivered, read] = await Promise.all([
      this.#dailyCounts(Campaign, userId, 'createdAt', start),
      this.#dailyCounts(Message, userId, 'createdAt', start),
      this.#dailyCounts(Message, userId, 'deliveredAt', start),
      this.#dailyCounts(Message, userId, 'readAt', start),
    ]);

    return { campaigns, messages, delivered, read };
  }

  // ── Top campaigns ───────────────────────────────────────────────────────────

  /**
   * The tenant's best-performing campaigns, ranked by read rate, then delivery
   * rate, then total reads. Only campaigns that have actually sent at least one
   * message are considered, so the leaderboard reflects real performance rather
   * than empty drafts. Ranking and limiting happen in the database.
   *
   * Returns rows of { _id, name, totalRead, totalDelivered, totalSent,
   * _readRate, _deliveryRate }; the Service rounds the rates for the response.
   */
  async topCampaigns(userId, limit) {
    return Campaign.aggregate([
      { $match: { userId: this.#oid(userId) } },
      ...this.#campaignMetricStages(userId),
      { $match: { totalSent: { $gt: 0 } } },
      { $sort: { _readRate: -1, _deliveryRate: -1, totalRead: -1, _id: 1 } },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          name: 1,
          totalRead: 1,
          totalDelivered: 1,
          totalSent: 1,
          _readRate: 1,
          _deliveryRate: 1,
        },
      },
    ]);
  }
}

export default new AnalyticsRepository();
