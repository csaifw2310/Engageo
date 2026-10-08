import api from './client';
import type { ApiResponse } from './resources';

/**
 * Service API layer (analytics, billing, settings, whatsapp, admin).
 *
 * Every shape below mirrors the real Engageo backend. Reads come back inside the
 * standard { success, message, data } envelope EXCEPT the admin module, which
 * spreads its rows + counters at the top level (e.g. { success, users,
 * totalUsers, totalPages, currentPage }). Both are typed faithfully here.
 */

// ── Analytics ──────────────────────────────────────────────────────────────────
// GET /analytics/dashboard
export interface DashboardAnalytics {
  totalContacts: number;
  totalGroups: number;
  totalCampaigns: number;
  totalMessages: number;
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalFailed: number;
  deliveryRate: number;
  readRate: number;
  failureRate: number;
}

// GET /analytics/trends  → [{ date, campaigns, messages, delivered, read }]
export interface TrendsData {
  date: string;
  campaigns: number;
  messages: number;
  delivered: number;
  read: number;
}

export const analyticsApi = {
  getDashboard: () =>
    api.get<ApiResponse<DashboardAnalytics>>('/analytics/dashboard').then(r => r.data),

  // Backend query param is `range` and accepts only 7d | 30d | 90d.
  getTrends: (params?: { range?: '7d' | '30d' | '90d' }) =>
    api.get<ApiResponse<TrendsData[]>>('/analytics/trends', { params }).then(r => r.data),

  getMessages: () =>
    api.get<ApiResponse<Record<string, unknown>>>('/analytics/messages').then(r => r.data),

  getContacts: () =>
    api.get<ApiResponse<Record<string, unknown>>>('/analytics/contacts').then(r => r.data),

  getTopCampaigns: () =>
    api.get<ApiResponse<Record<string, unknown>[]>>('/analytics/top-campaigns').then(r => r.data),

  getCampaignAnalytics: (params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<Record<string, unknown>>>('/analytics/campaigns', { params }).then(r => r.data),
};

// ── Billing ────────────────────────────────────────────────────────────────────
// GET /billing/summary → flat effective-plan + usage payload.
export interface BillingSummary {
  plan: string;
  status: string;
  billingCycle: string | null;
  autoRenew: boolean;
  contactsUsed: number;
  contactsLimit: number;
  messagesUsed: number;
  messagesLimit: number;
  campaignsUsed: number;
  campaignsLimit: number;
  startsAt: string | null;
  expiresAt: string | null;
  cancelledAt: string | null;
}

// GET /plans → public plan catalogue.
export interface CatalogPlan {
  _id: string;
  name: string;
  description?: string;
  priceMonthly: number;
  priceYearly: number;
  maxContacts: number;
  maxCampaignsPerMonth: number;
  maxMessagesPerMonth: number;
  features: string[];
  isActive: boolean;
}

// GET /payments → tenant payment history (amounts are whole rupees, INR).
export interface PaymentRecord {
  _id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
}

export interface PaymentsPage {
  payments: PaymentRecord[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

export const billingApi = {
  getSummary: () =>
    api.get<ApiResponse<BillingSummary>>('/billing/summary').then(r => r.data),

  getPlans: () =>
    api.get<ApiResponse<CatalogPlan[]>>('/plans').then(r => r.data),

  getCurrentSubscription: () =>
    api.get<ApiResponse<Record<string, unknown> | null>>('/subscriptions/current').then(r => r.data),

  getPayments: (params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<PaymentsPage>>('/payments', { params }).then(r => r.data),

  // Select / upgrade a plan. Free plans activate immediately; paid plans return
  // a Razorpay order in data.paymentOrder for the client to complete checkout.
  subscribe: (data: { planId: string; billingCycle?: 'MONTHLY' | 'YEARLY'; autoRenew?: boolean }) =>
    api.post<ApiResponse<{ subscriptionId: string; status: string; paymentOrder: unknown }>>('/subscriptions', data).then(r => r.data),

  upgrade: (data: { planId: string; billingCycle?: 'MONTHLY' | 'YEARLY'; autoRenew?: boolean }) =>
    api.post<ApiResponse<{ subscriptionId: string; status: string; paymentOrder: unknown }>>('/subscriptions/upgrade', data).then(r => r.data),

  cancel: () =>
    api.post('/subscriptions/cancel').then(r => r.data),
};

// ── Settings ───────────────────────────────────────────────────────────────────
export interface ProfileSettings {
  fullName: string;
  phoneNumber: string;
  avatarUrl: string;
}

export interface BusinessSettings {
  businessName: string;
  website: string;
  industry: string;
  address: string;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  campaignCompleted: boolean;
  campaignFailed: boolean;
  paymentAlerts: boolean;
  subscriptionAlerts: boolean;
}

export interface PreferenceSettings {
  timezone: string;
}

export const settingsApi = {
  getProfile: () =>
    api.get<ApiResponse<ProfileSettings>>('/settings/profile').then(r => r.data),

  updateProfile: (data: Partial<ProfileSettings>) =>
    api.patch<ApiResponse<ProfileSettings>>('/settings/profile', data).then(r => r.data),

  getBusiness: () =>
    api.get<ApiResponse<BusinessSettings>>('/settings/business').then(r => r.data),

  updateBusiness: (data: Partial<BusinessSettings>) =>
    api.patch<ApiResponse<BusinessSettings>>('/settings/business', data).then(r => r.data),

  getNotifications: () =>
    api.get<ApiResponse<NotificationSettings>>('/settings/notifications').then(r => r.data),

  updateNotifications: (data: Partial<NotificationSettings>) =>
    api.patch<ApiResponse<NotificationSettings>>('/settings/notifications', data).then(r => r.data),

  getPreferences: () =>
    api.get<ApiResponse<PreferenceSettings>>('/settings/preferences').then(r => r.data),

  updatePreferences: (data: Partial<PreferenceSettings>) =>
    api.patch<ApiResponse<PreferenceSettings>>('/settings/preferences', data).then(r => r.data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post('/auth/change-password', data).then(r => r.data),
};

// ── WhatsApp ───────────────────────────────────────────────────────────────────
// GET /whatsapp/status → { status: 'connected' | 'disconnected' }
// GET /whatsapp/me     → full connection (sans accessToken) or 404 when none.
export interface WhatsAppConnection {
  _id?: string;
  phoneNumber?: string;
  businessName?: string;
  businessAccountId?: string;
  phoneNumberId?: string;
  status?: string;
  connectedAt?: string;
}

export interface WhatsAppConnectPayload {
  businessAccountId: string;
  phoneNumberId: string;
  phoneNumber: string;
  businessName: string;
  accessToken: string;
}

export const whatsappApi = {
  getStatus: () =>
    api.get<ApiResponse<{ status: string }>>('/whatsapp/status').then(r => r.data),

  getConnection: () =>
    api.get<ApiResponse<WhatsAppConnection>>('/whatsapp/me').then(r => r.data),

  connect: (data: WhatsAppConnectPayload) =>
    api.post('/whatsapp/connect', data).then(r => r.data),

  exchangeCode: (code: string) =>
    api.post<ApiResponse<WhatsAppConnection>>('/whatsapp/connect-meta', { code }).then(r => r.data),

  disconnect: () =>
    api.post('/whatsapp/disconnect').then(r => r.data),

  sync: () =>
    api.post<ApiResponse<WhatsAppConnection>>('/whatsapp/sync').then(r => r.data),
};

// ── Admin ──────────────────────────────────────────────────────────────────────
export interface AdminDashboard {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  paidUsers: number;
  freeUsers: number;
  totalRevenue: number;
  totalCampaigns: number;
  totalMessages: number;
  activeSubscriptions: number;
  cancelledSubscriptions: number;
  usersThisMonth: number;
  campaignsThisMonth: number;
  messagesThisMonth: number;
  revenueThisMonth: number;
}

// Users are returned normalized: { id, name, email, role, status, createdAt, currentPlan }
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  currentPlan?: string | null;
}

export interface AdminUsersResponse {
  success: boolean;
  users: AdminUser[];
  totalUsers: number;
  totalPages: number;
  currentPage: number;
}

export interface AdminPlan {
  _id: string;
  name: string;
  description?: string;
  priceMonthly: number;
  priceYearly: number;
  maxContacts: number;
  maxCampaignsPerMonth: number;
  maxMessagesPerMonth: number;
  features: string[];
  isActive: boolean;
  createdAt?: string;
}

export interface AdminSubscription {
  _id: string;
  userId?: { _id: string; name: string; email: string };
  planId?: { _id: string; name: string; priceMonthly?: number };
  status: string;
  billingCycle?: string;
  startsAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface AdminSubscriptionsResponse {
  success: boolean;
  subscriptions: AdminSubscription[];
  totalSubscriptions: number;
  totalPages: number;
  currentPage: number;
}

export interface AdminPayment {
  _id: string;
  userId?: { _id: string; name: string; email: string };
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export interface AdminPaymentsResponse {
  success: boolean;
  payments: AdminPayment[];
  totalPayments: number;
  totalPages: number;
  currentPage: number;
}

export interface CreateAdminPlanPayload {
  name: string;
  description?: string;
  priceMonthly: number;
  priceYearly: number;
  maxContacts: number;
  maxCampaignsPerMonth: number;
  maxMessagesPerMonth: number;
  features: string[];
}

export const adminApi = {
  getDashboard: () =>
    api.get<ApiResponse<AdminDashboard>>('/admin/dashboard').then(r => r.data),

  getUsers: (params?: { page?: number; limit?: number; search?: string; status?: string; role?: string }) =>
    api.get<AdminUsersResponse>('/admin/users', { params }).then(r => r.data),

  getUser: (id: string) =>
    api.get<ApiResponse<AdminUser>>(`/admin/users/${id}`).then(r => r.data),

  suspendUser: (id: string) =>
    api.patch(`/admin/users/${id}/suspend`).then(r => r.data),

  activateUser: (id: string) =>
    api.patch(`/admin/users/${id}/activate`).then(r => r.data),

  getPlans: () =>
    api.get<{ success: boolean; plans: AdminPlan[] }>('/admin/plans').then(r => r.data),

  createPlan: (data: CreateAdminPlanPayload) =>
    api.post('/admin/plans', data).then(r => r.data),

  updatePlan: (id: string, data: Partial<CreateAdminPlanPayload>) =>
    api.patch(`/admin/plans/${id}`, data).then(r => r.data),

  deletePlan: (id: string) =>
    api.delete(`/admin/plans/${id}`).then(r => r.data),

  getSubscriptions: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<AdminSubscriptionsResponse>('/admin/subscriptions', { params }).then(r => r.data),

  getSubscription: (id: string) =>
    api.get<ApiResponse<AdminSubscription>>(`/admin/subscriptions/${id}`).then(r => r.data),

  cancelSubscription: (id: string) =>
    api.patch(`/admin/subscriptions/${id}/cancel`).then(r => r.data),

  upgradeSubscription: (id: string, planId: string) =>
    api.patch(`/admin/subscriptions/${id}/upgrade`, { planId }).then(r => r.data),

  getPayments: (params?: { page?: number; limit?: number; status?: string; search?: string }) =>
    api.get<AdminPaymentsResponse>('/admin/payments', { params }).then(r => r.data),

  getPayment: (id: string) =>
    api.get<ApiResponse<AdminPayment>>(`/admin/payments/${id}`).then(r => r.data),

  getAnalytics: () =>
    api.get<ApiResponse<Record<string, unknown>>>('/admin/analytics').then(r => r.data),
};