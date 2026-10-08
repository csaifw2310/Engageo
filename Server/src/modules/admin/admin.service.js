/**
 * @fileoverview Admin Service — business logic layer for the Admin module.
 * Orchestrates repository calls and enforces business rules.
 * @module admin/service
 */

import {
  getDashboardStats,
  findUsers,
  findUserById,
  getUserActivityCounts,
  updateUserStatus,
  findAllPlans,
  createPlan,
  findPlanById,
  updatePlanById,
  isPlanInUse,
  softDeletePlan,
  findSubscriptions,
  findSubscriptionById,
  updateSubscriptionById,
  findPayments,
  findPaymentById,
  getPlatformAnalytics,
} from './admin.repository.js';

import {
  ADMIN_ERRORS,
  ADMIN_SUCCESS,
  SUBSCRIPTION_STATUS,
  USER_STATUS,
} from './admin.constants.js';

// ---------------------------------------------------------------------------
// Error factory
// ---------------------------------------------------------------------------

const createError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

// ===========================================================================
// DASHBOARD
// ===========================================================================

export const getDashboard = async () => {
  return getDashboardStats();
};

// ===========================================================================
// USERS
// ===========================================================================

export const listUsers = async ({ page, limit, search, role, status }) => {
  const { users, total } = await findUsers({ page, limit, search, role, status });

  const normalized = users.map((u) => ({
    id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
    currentPlan: u.subscription?.plan?.name ?? null,
  }));

  return {
    users: normalized,
    totalUsers: total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  };
};

export const getUserProfile = async (userId) => {
  const [user, counts] = await Promise.all([
    findUserById(userId),
    getUserActivityCounts(userId),
  ]);

  if (!user) throw createError(ADMIN_ERRORS.USER_NOT_FOUND, 404);

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    settings: user.settings ?? null,
    subscription: user.subscription ?? null,
    campaignCount: counts.campaignCount,
    messageCount: counts.messageCount,
    paymentCount: counts.paymentCount,
    whatsappConnections: counts.whatsappConnections,
  };
};

export const suspendUser = async (userId) => {
  const user = await findUserById(userId);
  if (!user) throw createError(ADMIN_ERRORS.USER_NOT_FOUND, 404);
  if (user.role === 'admin') throw createError(ADMIN_ERRORS.CANNOT_SUSPEND_ADMIN, 403);
  if (user.status === USER_STATUS.SUSPENDED) throw createError(ADMIN_ERRORS.USER_ALREADY_SUSPENDED);

  await updateUserStatus(userId, USER_STATUS.SUSPENDED);
  return { success: true, message: ADMIN_SUCCESS.USER_SUSPENDED };
};

export const activateUser = async (userId) => {
  const user = await findUserById(userId);
  if (!user) throw createError(ADMIN_ERRORS.USER_NOT_FOUND, 404);
  if (user.status === USER_STATUS.ACTIVE) throw createError(ADMIN_ERRORS.USER_ALREADY_ACTIVE);

  await updateUserStatus(userId, USER_STATUS.ACTIVE);
  return { success: true, message: ADMIN_SUCCESS.USER_ACTIVATED };
};

// ===========================================================================
// PLANS
// ===========================================================================

export const listPlans = async () => {
  return findAllPlans();
};

export const addPlan = async (data) => {
  const plan = await createPlan({
    name: data.name.trim(),
    description: data.description ?? '',
    priceMonthly: Number(data.priceMonthly),
    priceYearly: Number(data.priceYearly),
    maxContacts: data.maxContacts !== undefined ? Number(data.maxContacts) : -1,
    maxGroups: data.maxGroups !== undefined ? Number(data.maxGroups) : -1,
    maxTemplates: data.maxTemplates !== undefined ? Number(data.maxTemplates) : -1,
    maxCampaignsPerMonth: data.maxCampaignsPerMonth !== undefined ? Number(data.maxCampaignsPerMonth) : -1,
    maxMessagesPerMonth: data.maxMessagesPerMonth !== undefined ? Number(data.maxMessagesPerMonth) : -1,
    features: Array.isArray(data.features) ? data.features : [],
    isActive: true,
  });

  return { success: true, message: ADMIN_SUCCESS.PLAN_CREATED, plan };
};

export const editPlan = async (planId, updates) => {
  const existing = await findPlanById(planId);
  if (!existing) throw createError(ADMIN_ERRORS.PLAN_NOT_FOUND, 404);

  const numericFields = ['priceMonthly', 'priceYearly', 'maxContacts', 'maxGroups', 'maxTemplates', 'maxCampaignsPerMonth', 'maxMessagesPerMonth'];
  const sanitized = { ...updates };
  for (const field of numericFields) {
    if (sanitized[field] !== undefined) sanitized[field] = Number(sanitized[field]);
  }

  const plan = await updatePlanById(planId, sanitized);
  return { success: true, message: ADMIN_SUCCESS.PLAN_UPDATED, plan };
};

export const removePlan = async (planId) => {
  const existing = await findPlanById(planId);
  if (!existing) throw createError(ADMIN_ERRORS.PLAN_NOT_FOUND, 404);

  const inUse = await isPlanInUse(planId);
  if (inUse) throw createError(ADMIN_ERRORS.PLAN_IN_USE, 409);

  await softDeletePlan(planId);
  return { success: true, message: ADMIN_SUCCESS.PLAN_DELETED };
};

// ===========================================================================
// SUBSCRIPTIONS
// ===========================================================================

export const listSubscriptions = async ({ page, limit, status }) => {
  const { subscriptions, total } = await findSubscriptions({ page, limit, status });

  return {
    subscriptions,
    totalSubscriptions: total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  };
};

export const getSubscriptionDetail = async (subscriptionId) => {
  const subscription = await findSubscriptionById(subscriptionId);
  if (!subscription) throw createError(ADMIN_ERRORS.SUBSCRIPTION_NOT_FOUND, 404);
  return subscription;
};

export const cancelSubscription = async (subscriptionId) => {
  const subscription = await findSubscriptionById(subscriptionId);
  if (!subscription) throw createError(ADMIN_ERRORS.SUBSCRIPTION_NOT_FOUND, 404);

  await updateSubscriptionById(subscriptionId, {
    status: SUBSCRIPTION_STATUS.CANCELLED,
    cancelledAt: new Date(),
  });

  return { success: true, message: ADMIN_SUCCESS.SUBSCRIPTION_CANCELLED };
};

/**
 * Admin upgrades a subscription to a different plan (no payment required).
 * @param {string} subscriptionId
 * @param {string} planId
 * @returns {Promise<{ success: boolean }>}
 */
export const upgradeSubscription = async (subscriptionId, planId) => {
  const [subscription, plan] = await Promise.all([
    findSubscriptionById(subscriptionId),
    findPlanById(planId),
  ]);

  if (!subscription) throw createError(ADMIN_ERRORS.SUBSCRIPTION_NOT_FOUND, 404);
  if (!plan) throw createError(ADMIN_ERRORS.PLAN_NOT_FOUND, 404);

  await updateSubscriptionById(subscriptionId, {
    planId: planId,
    status: SUBSCRIPTION_STATUS.ACTIVE,
    upgradedAt: new Date(),
    upgradedByAdmin: true,
  });

  return { success: true, message: ADMIN_SUCCESS.SUBSCRIPTION_UPGRADED };
};

// ===========================================================================
// PAYMENTS
// ===========================================================================

export const listPayments = async ({ page, limit, status, search }) => {
  const { payments, total } = await findPayments({ page, limit, status, search });

  return {
    payments,
    totalPayments: total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  };
};

export const getPaymentDetail = async (paymentId) => {
  const payment = await findPaymentById(paymentId);
  if (!payment) throw createError(ADMIN_ERRORS.PAYMENT_NOT_FOUND, 404);
  return payment;
};

// ===========================================================================
// ANALYTICS
// ===========================================================================

export const getAnalytics = async () => {
  return getPlatformAnalytics();
};