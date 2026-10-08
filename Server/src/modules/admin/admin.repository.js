/**
 * @fileoverview Admin Repository — raw database access layer for the Admin module.
 * All methods return plain JS objects (lean queries) unless noted.
 * @module admin/repository
 */

import mongoose from 'mongoose';
import { SUBSCRIPTION_STATUS, USER_STATUS } from './admin.constants.js';

// ---------------------------------------------------------------------------
// Lazy model resolution — avoids circular import issues at startup
// ---------------------------------------------------------------------------

/** @returns {mongoose.Model} */
const User = () => mongoose.model('User');

/** @returns {mongoose.Model} */
const Plan = () => mongoose.model('Plan');

/** @returns {mongoose.Model} */
const Subscription = () => mongoose.model('Subscription');

/** @returns {mongoose.Model} */
const Payment = () => mongoose.model('Payment');

/** @returns {mongoose.Model} */
const Campaign = () => mongoose.model('Campaign');

/** @returns {mongoose.Model} */
const Message = () => mongoose.model('Message');

// ===========================================================================
// DASHBOARD
// ===========================================================================

/**
 * Aggregates platform-wide dashboard statistics.
 * @returns {Promise<object>}
 */
export const getDashboardStats = async () => {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [
    userStats,
    campaignStats,
    messageStats,
    revenueStats,
    subscriptionStats,
    usersThisMonth,
    campaignsThisMonth,
    messagesThisMonth,
    revenueThisMonth,
  ] = await Promise.all([
    // User breakdown
    User().aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', USER_STATUS.ACTIVE] }, 1, 0] } },
          suspended: { $sum: { $cond: [{ $eq: ['$status', USER_STATUS.SUSPENDED] }, 1, 0] } },
        },
      },
    ]),

    // Campaigns total
    Campaign().countDocuments(),

    // Messages total
    Message().estimatedDocumentCount(),

    // Revenue total (sum of successful payments)
    Payment().aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),

    // Subscription breakdown
    Subscription().aggregate([
      {
        $group: {
          _id: null,
          active: { $sum: { $cond: [{ $eq: ['$status', SUBSCRIPTION_STATUS.ACTIVE] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', SUBSCRIPTION_STATUS.CANCELLED] }, 1, 0] } },
        },
      },
    ]),

    // Users this month
    User().countDocuments({ createdAt: { $gte: startOfMonth } }),

    // Campaigns this month
    Campaign().countDocuments({ createdAt: { $gte: startOfMonth } }),

    // Messages this month
    Message().countDocuments({ createdAt: { $gte: startOfMonth } }),

    // Revenue this month
    Payment().aggregate([
      { $match: { status: 'success', createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  // Paid vs Free users (users with an active subscription = paid)
  const [paidUsers, freeUsers] = await Promise.all([
    Subscription().distinct('userId', { status: SUBSCRIPTION_STATUS.ACTIVE }).then((ids) => ids.length),
    User()
      .countDocuments()
      .then(async (total) => {
        const paid = await Subscription().distinct('userId', { status: SUBSCRIPTION_STATUS.ACTIVE }).then((ids) => ids.length);
        return total - paid;
      }),
  ]);

  const u = userStats[0] || { total: 0, active: 0, suspended: 0 };
  const sub = subscriptionStats[0] || { active: 0, cancelled: 0 };

  return {
    totalUsers: u.total,
    activeUsers: u.active,
    suspendedUsers: u.suspended,
    freeUsers,
    paidUsers,
    totalCampaigns: campaignStats,
    totalMessages: messageStats,
    totalRevenue: revenueStats[0]?.total ?? 0,
    activeSubscriptions: sub.active,
    cancelledSubscriptions: sub.cancelled,
    usersThisMonth,
    campaignsThisMonth,
    messagesThisMonth,
    revenueThisMonth: revenueThisMonth[0]?.total ?? 0,
  };
};

// ===========================================================================
// USERS
// ===========================================================================

/**
 * Lists users with pagination, search, and filters.
 * @param {{ page: number, limit: number, search?: string, role?: string, status?: string }} opts
 * @returns {Promise<{ users: object[], total: number }>}
 */
export const findUsers = async ({ page, limit, search, role, status }) => {
  const filter = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  if (role) filter.role = role;
  if (status) filter.status = status;

  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User()
      .find(filter)
      .select('_id name email role status createdAt')
      .skip(skip)
      .limit(limit)
      .lean(),
    User().countDocuments(filter),
  ]);

  return { users, total };
};

/**
 * Finds a single user by ID with full profile data.
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export const findUserById = async (userId) => {
  return User()
    .findById(userId)
    .select('-password -__v')
    .lean();
};

/**
 * Returns campaign, message, payment counts and WhatsApp connections for a user.
 * @param {string} userId
 * @returns {Promise<object>}
 */
export const getUserActivityCounts = async (userId) => {
  const oid = new mongoose.Types.ObjectId(userId);

  const [campaignCount, messageCount, paymentCount] = await Promise.all([
    Campaign().countDocuments({ user: oid }),
    Message().countDocuments({ user: oid }),
    Payment().countDocuments({ userId: oid }),
  ]);

  // WhatsApp connections stored on the user document itself or a separate model
  let whatsappConnections = 0;
  try {
    const WhatsApp = mongoose.model('WhatsAppConnection');
    whatsappConnections = await WhatsApp.countDocuments({ user: oid });
  } catch {
    // Model may not be registered in all environments
  }

  return { campaignCount, messageCount, paymentCount, whatsappConnections };
};

/**
 * Updates a user's status field.
 * @param {string} userId
 * @param {string} status
 * @returns {Promise<object|null>}
 */
export const updateUserStatus = async (userId, status) => {
  return User().findByIdAndUpdate(userId, { status }, { new: true }).select('_id name email status').lean();
};

// ===========================================================================
// PLANS
// ===========================================================================

/**
 * Returns all active plans.
 * @returns {Promise<object[]>}
 */
export const findAllPlans = async () => {
  return Plan().find({ isActive: { $ne: false } }).lean();
};

/**
 * Creates a new plan.
 * @param {object} data
 * @returns {Promise<object>}
 */
export const createPlan = async (data) => {
  const plan = await Plan().create(data);
  return plan.toObject();
};

/**
 * Finds a plan by ID.
 * @param {string} planId
 * @returns {Promise<object|null>}
 */
export const findPlanById = async (planId) => {
  return Plan().findById(planId).lean();
};

/**
 * Updates a plan by ID.
 * @param {string} planId
 * @param {object} updates
 * @returns {Promise<object|null>}
 */
export const updatePlanById = async (planId, updates) => {
  return Plan().findByIdAndUpdate(planId, updates, { new: true, runValidators: true }).lean();
};

/**
 * Checks if any active subscription references this plan.
 * @param {string} planId
 * @returns {Promise<boolean>}
 */
export const isPlanInUse = async (planId) => {
  const count = await Subscription().countDocuments({
    planId: planId,
    status: SUBSCRIPTION_STATUS.ACTIVE,
  });
  return count > 0;
};

/**
 * Soft-deletes a plan (sets isActive: false).
 * @param {string} planId
 * @returns {Promise<object|null>}
 */
export const softDeletePlan = async (planId) => {
  return Plan().findByIdAndUpdate(planId, { isActive: false }, { new: true }).lean();
};

// ===========================================================================
// SUBSCRIPTIONS
// ===========================================================================

/**
 * Lists subscriptions with optional status filter and pagination.
 * @param {{ page: number, limit: number, status?: string }} opts
 * @returns {Promise<{ subscriptions: object[], total: number }>}
 */
export const findSubscriptions = async ({ page, limit, status }) => {
  const filter = {};
  if (status) filter.status = status;

  const skip = (page - 1) * limit;

  const [subscriptions, total] = await Promise.all([
    Subscription()
      .find(filter)
      .populate('userId', 'name email')
      .populate('planId', 'name priceMonthly priceYearly')
      .select('userId planId status billingCycle startsAt expiresAt createdAt')
      .skip(skip)
      .limit(limit)
      .lean(),
    Subscription().countDocuments(filter),
  ]);

  return { subscriptions, total };
};

/**
 * Finds a subscription by ID with full details.
 * @param {string} subscriptionId
 * @returns {Promise<object|null>}
 */
export const findSubscriptionById = async (subscriptionId) => {
  return Subscription()
    .findById(subscriptionId)
    .populate('userId', 'name email')
    .populate('planId')
    .lean();
};

/**
 * Updates a subscription's status.
 * @param {string} subscriptionId
 * @param {object} updates
 * @returns {Promise<object|null>}
 */
export const updateSubscriptionById = async (subscriptionId, updates) => {
  return Subscription()
    .findByIdAndUpdate(subscriptionId, updates, { new: true, runValidators: true })
    .lean();
};

// ===========================================================================
// PAYMENTS
// ===========================================================================

/**
 * Lists all payments with optional filters and pagination.
 * @param {{ page: number, limit: number, status?: string, search?: string }} opts
 * @returns {Promise<{ payments: object[], total: number }>}
 */
export const findPayments = async ({ page, limit, status, search }) => {
  const filter = {};
  if (status) filter.status = status;

  if (search) {
    // Search by order ID or user (after lookup — handled via $or on orderId)
    filter.$or = [{ orderId: { $regex: search, $options: 'i' } }];
  }

  const skip = (page - 1) * limit;

  const [payments, total] = await Promise.all([
    Payment()
      .find(filter)
      .populate('userId', 'name email')
      .populate({ path: 'subscriptionId', populate: { path: 'planId', select: 'name' } })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(),
    Payment().countDocuments(filter),
  ]);

  return { payments, total };
};

/**
 * Finds a payment by ID with full details.
 * @param {string} paymentId
 * @returns {Promise<object|null>}
 */
export const findPaymentById = async (paymentId) => {
  return Payment()
    .findById(paymentId)
    .populate('userId', 'name email')
    .populate({ path: 'subscriptionId', populate: { path: 'planId' } })
    .lean();
};

// ===========================================================================
// ANALYTICS
// ===========================================================================

/**
 * Aggregates platform-wide analytics metrics across all tenants.
 * @returns {Promise<object>}
 */
export const getPlatformAnalytics = async () => {
  const [
    campaignStats,
    messageStats,
    revenueStats,
    activeUsers,
    activeSubscriptions,
  ] = await Promise.all([
    Campaign().countDocuments(),

    Message().aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
          read: { $sum: { $cond: [{ $eq: ['$status', 'read'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        },
      },
    ]),

    Payment().aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),

    User().countDocuments({ status: USER_STATUS.ACTIVE }),

    Subscription().countDocuments({ status: SUBSCRIPTION_STATUS.ACTIVE }),
  ]);

  const msg = messageStats[0] || { total: 0, delivered: 0, read: 0, failed: 0 };
  const total = msg.total || 1; // avoid division by zero

  return {
    totalCampaigns: campaignStats,
    totalMessages: msg.total,
    totalDelivered: msg.delivered,
    totalRead: msg.read,
    totalFailed: msg.failed,
    deliveryRate: parseFloat(((msg.delivered / total) * 100).toFixed(2)),
    readRate: parseFloat(((msg.read / total) * 100).toFixed(2)),
    totalRevenue: revenueStats[0]?.total ?? 0,
    activeUsers,
    activeSubscriptions,
  };
};