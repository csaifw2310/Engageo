import repository from './analytics.repository.js';
import ApiError from '../../utils/ApiError.js';
import {
  MESSAGE_STATUS,
  ANALYTICS_PAGINATION,
  ANALYTICS_SORT,
  ANALYTICS_DEFAULT_SORT,
  ANALYTICS_TREND_RANGE,
  ANALYTICS_DEFAULT_TREND_RANGE,
  TOP_CAMPAIGNS_LIMIT,
  ANALYTICS_MESSAGES,
} from './analytics.constants.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Analytics reporting service.
 *
 * Strictly READ-ONLY: every method derives its figures, on request, from the
 * live collections via the repository's aggregation pipelines. Nothing is
 * stored, cached or written. Each method is tenant-scoped — it takes the
 * authenticated `userId` and the repository re-asserts that scope on every
 * query and join, so no code path can surface another tenant's data.
 *
 * The Service owns presentation concerns the database should not: turning raw
 * counts into rounded percentage rates, assembling the funnel from the status
 * breakdown, building pagination envelopes and zero-filling trend series. All
 * heavy lifting (grouping/counting/sorting) stays in MongoDB.
 */
class AnalyticsService {
  // ── Rate helpers ────────────────────────────────────────────────────────────

  /** Round to 2 decimal places, robust against binary-float artefacts. */
  #round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  /**
   * A percentage rate, guarded against divide-by-zero. Returns 0 (not NaN) when
   * the denominator is 0 — e.g. readRate is 0 when nothing was delivered.
   */
  #rate(numerator, denominator) {
    if (!denominator || denominator <= 0) return 0;
    return this.#round2((numerator / denominator) * 100);
  }

  /**
   * Derive the delivery funnel from an exact-status breakdown
   * ({ PENDING, QUEUED, SENT, DELIVERED, READ, FAILED }).
   *
   * The funnel is inclusive, mirroring the Messaging / Webhook modules:
   *   • sent      = SENT + DELIVERED + READ  (delivered/read were still sent)
   *   • delivered = DELIVERED + READ         (read was still delivered)
   *   • read      = READ
   *   • failed    = FAILED
   * with deliveryRate = delivered/sent, readRate = read/delivered,
   * failureRate = failed/sent.
   */
  #funnelFromBreakdown(breakdown) {
    const totalSent =
      breakdown[MESSAGE_STATUS.SENT] +
      breakdown[MESSAGE_STATUS.DELIVERED] +
      breakdown[MESSAGE_STATUS.READ];
    const totalDelivered =
      breakdown[MESSAGE_STATUS.DELIVERED] + breakdown[MESSAGE_STATUS.READ];
    const totalRead = breakdown[MESSAGE_STATUS.READ];
    const totalFailed = breakdown[MESSAGE_STATUS.FAILED];

    return {
      totalSent,
      totalDelivered,
      totalRead,
      totalFailed,
      deliveryRate: this.#rate(totalDelivered, totalSent),
      readRate: this.#rate(totalRead, totalDelivered),
      failureRate: this.#rate(totalFailed, totalSent),
    };
  }

  // ── Dashboard overview ──────────────────────────────────────────────────────

  /**
   * Top-level dashboard metrics for the tenant: collection totals plus the
   * account-wide message delivery funnel. Two parallel aggregations (cheap
   * counts + one grouped status breakdown), kept well under the latency target.
   */
  async getDashboard(userId) {
    const [counts, breakdown] = await Promise.all([
      repository.countCollections(userId),
      repository.messageStatusBreakdown(userId),
    ]);

    const funnel = this.#funnelFromBreakdown(breakdown);

    return {
      totalContacts: counts.totalContacts,
      totalGroups: counts.totalGroups,
      totalCampaigns: counts.totalCampaigns,
      totalMessages: counts.totalMessages,

      totalSent: funnel.totalSent,
      totalDelivered: funnel.totalDelivered,
      totalRead: funnel.totalRead,
      totalFailed: funnel.totalFailed,

      deliveryRate: funnel.deliveryRate,
      readRate: funnel.readRate,
      failureRate: funnel.failureRate,
    };
  }

  // ── Campaign analytics (paginated list) ─────────────────────────────────────

  /** Translate a validated sort option into a MongoDB $sort spec. */
  #campaignSortSpec(sort) {
    switch (sort) {
      case ANALYTICS_SORT.OLDEST:
        return { createdAt: 1, _id: 1 };
      case ANALYTICS_SORT.BEST_PERFORMING:
        return { _readRate: -1, _deliveryRate: -1, totalRead: -1, _id: 1 };
      case ANALYTICS_SORT.WORST_PERFORMING:
        return { _readRate: 1, _deliveryRate: 1, totalRead: 1, _id: 1 };
      case ANALYTICS_SORT.NEWEST:
      default:
        return { createdAt: -1, _id: -1 };
    }
  }

  /**
   * Paginated per-campaign analytics for the tenant. Recipients come from the
   * campaign's snapshot (`totalRecipients`); the delivery counts are computed
   * live from the Message collection inside the pipeline, so they reflect the
   * current truth rather than any stored counter.
   */
  async getCampaignAnalytics(userId, query = {}) {
    const page = Math.max(
      parseInt(query.page, 10) || ANALYTICS_PAGINATION.DEFAULT_PAGE,
      1
    );
    const limit = Math.min(
      Math.max(
        parseInt(query.limit, 10) || ANALYTICS_PAGINATION.DEFAULT_LIMIT,
        1
      ),
      ANALYTICS_PAGINATION.MAX_LIMIT
    );
    const skip = (page - 1) * limit;
    const sort = this.#campaignSortSpec(query.sort || ANALYTICS_DEFAULT_SORT);

    const [rows, total] = await Promise.all([
      repository.campaignMetricsPage(userId, { skip, limit, sort }),
      repository.countCampaigns(userId),
    ]);

    const campaigns = rows.map((c) => ({
      campaignId: String(c._id),
      name: c.name,
      status: c.status,
      totalRecipients: c.totalRecipients || 0,
      totalSent: c.totalSent,
      totalDelivered: c.totalDelivered,
      totalRead: c.totalRead,
      totalFailed: c.totalFailed,
      deliveryRate: this.#rate(c.totalDelivered, c.totalSent),
      readRate: this.#rate(c.totalRead, c.totalDelivered),
    }));

    return {
      campaigns,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 0,
      },
    };
  }

  // ── Single campaign analytics ───────────────────────────────────────────────

  /**
   * Detailed analytics for one owned campaign. Verifies ownership first (404 if
   * the campaign does not exist or belongs to another tenant), then computes the
   * delivery funnel for that campaign from its messages.
   */
  async getCampaignById(userId, campaignId) {
    const campaign = await repository.findCampaign(userId, campaignId);
    if (!campaign) {
      throw new ApiError(404, ANALYTICS_MESSAGES.CAMPAIGN_NOT_FOUND);
    }

    const breakdown = await repository.messageStatusBreakdown(
      userId,
      campaignId
    );
    const funnel = this.#funnelFromBreakdown(breakdown);

    return {
      campaign,
      metrics: {
        totalRecipients: campaign.totalRecipients || 0,
        totalSent: funnel.totalSent,
        totalDelivered: funnel.totalDelivered,
        totalRead: funnel.totalRead,
        totalFailed: funnel.totalFailed,
        deliveryRate: funnel.deliveryRate,
        readRate: funnel.readRate,
        failureRate: funnel.failureRate,
      },
    };
  }

  // ── Message analytics ───────────────────────────────────────────────────────

  /**
   * Account-wide message counts broken down by EXACT status (mutually exclusive
   * buckets that sum to totalMessages). Distinct from the dashboard funnel,
   * which is inclusive — here `sent` means messages currently in the SENT state,
   * not "sent or beyond".
   */
  async getMessageAnalytics(userId) {
    const b = await repository.messageStatusBreakdown(userId);

    const totalMessages =
      b[MESSAGE_STATUS.PENDING] +
      b[MESSAGE_STATUS.QUEUED] +
      b[MESSAGE_STATUS.SENT] +
      b[MESSAGE_STATUS.DELIVERED] +
      b[MESSAGE_STATUS.READ] +
      b[MESSAGE_STATUS.FAILED];

    return {
      totalMessages,
      pending: b[MESSAGE_STATUS.PENDING],
      queued: b[MESSAGE_STATUS.QUEUED],
      sent: b[MESSAGE_STATUS.SENT],
      delivered: b[MESSAGE_STATUS.DELIVERED],
      read: b[MESSAGE_STATUS.READ],
      failed: b[MESSAGE_STATUS.FAILED],
    };
  }

  // ── Contact analytics ─────────────────────────────────────────────────────

  /** Contact totals split by active / inactive status. */
  async getContactAnalytics(userId) {
    const { total, active, inactive } =
      await repository.contactStatusBreakdown(userId);

    return {
      totalContacts: total,
      activeContacts: active,
      inactiveContacts: inactive,
    };
  }

  // ── Group analytics ───────────────────────────────────────────────────────

  /**
   * Group totals, the average number of contacts per group, and the single
   * largest group. Average is membership-count / group-count (0 when the tenant
   * has no groups). largestGroup is null when there are no memberships yet.
   */
  async getGroupAnalytics(userId) {
    const [totalGroups, sizing] = await Promise.all([
      repository.countGroups(userId),
      repository.groupSizing(userId),
    ]);

    const averageContactsPerGroup =
      totalGroups > 0
        ? this.#round2(sizing.totalMemberships / totalGroups)
        : 0;

    const largestGroup = sizing.largestGroup
      ? {
          id: String(sizing.largestGroup.id),
          name: sizing.largestGroup.name,
          contactCount: sizing.largestGroup.contactCount,
        }
      : null;

    return {
      totalGroups,
      averageContactsPerGroup,
      largestGroup,
    };
  }

  // ── Trends ────────────────────────────────────────────────────────────────

  /** UTC midnight `days - 1` days before today (start of the trend window). */
  #trendStart(days) {
    const now = new Date();
    const todayUtcMidnight = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    );
    return new Date(todayUtcMidnight - (days - 1) * MS_PER_DAY);
  }

  /** The ordered list of "YYYY-MM-DD" UTC day strings covering the window. */
  #dateScaffold(start, days) {
    const out = [];
    for (let i = 0; i < days; i += 1) {
      out.push(
        new Date(start.getTime() + i * MS_PER_DAY).toISOString().slice(0, 10)
      );
    }
    return out;
  }

  /**
   * Daily campaign / message / delivery / read counts over the requested range.
   * Days with no activity are returned with zeros and the series is sorted
   * chronologically, so callers can chart it directly.
   */
  async getTrends(userId, query = {}) {
    const range = ANALYTICS_TREND_RANGE[query.range]
      ? query.range
      : ANALYTICS_DEFAULT_TREND_RANGE;
    const days = ANALYTICS_TREND_RANGE[range];

    const start = this.#trendStart(days);
    const scaffold = this.#dateScaffold(start, days);

    const series = await repository.dailyTrendSeries(userId, start);

    return scaffold.map((date) => ({
      date,
      campaigns: series.campaigns.get(date) || 0,
      messages: series.messages.get(date) || 0,
      delivered: series.delivered.get(date) || 0,
      read: series.read.get(date) || 0,
    }));
  }

  // ── Top campaigns ───────────────────────────────────────────────────────────

  /**
   * The tenant's top campaigns (max 10) ranked by read rate, then delivery rate,
   * then total reads. Only campaigns that have sent at least one message are
   * considered.
   */
  async getTopCampaigns(userId) {
    const rows = await repository.topCampaigns(userId, TOP_CAMPAIGNS_LIMIT);

    return rows.map((c) => ({
      campaignId: String(c._id),
      campaignName: c.name,
      readRate: this.#rate(c.totalRead, c.totalDelivered),
      deliveryRate: this.#rate(c.totalDelivered, c.totalSent),
      totalReads: c.totalRead,
    }));
  }
}

export default new AnalyticsService();
