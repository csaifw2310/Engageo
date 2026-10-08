import api from './client'; // ✅ fixed: was './axios', now uses the authenticated client

// ── Envelope wrapper (every backend response uses this shape) ──────────────────
interface Envelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

// ── Domain types ──────────────────────────────────────────────────────────────

export interface BillingSummary {
  plan: string;
  status: string;
  billingCycle?: 'monthly' | 'yearly' | null;
  expiresAt?: string | null;
  messagesUsed: number;
  messagesLimit: number;
  contactsUsed: number;
  contactsLimit: number;
  campaignsUsed: number;
  campaignsLimit: number;
  autoRenew: boolean;
  startsAt?: string | null;
  cancelledAt?: string | null;
}

export interface Plan {
  _id: string;
  name: string;
  slug?: string;
  priceMonthly: number;
  priceYearly: number;
  messageLimit: number;
  maxContacts: number;
  maxCampaignsPerMonth: number;
  maxMessagesPerMonth: number;
  features: string[];
  isActive: boolean;
}

export interface Payment {
  _id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
}

export interface PaginatedPayments {
  payments: Payment[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

export interface Subscription {
  _id: string;
  planId: string;
  status: string;
  billingCycle: 'monthly' | 'yearly';
  autoRenew: boolean;
}

export interface PaymentOrder {
  id: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface UpgradeSubscriptionPayload {
  planId: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  autoRenew?: boolean;
}

export interface UpgradeSubscriptionResponse {  
  subscriptionId: string;
  status: string;
  paymentOrder: PaymentOrder | null;
}

export interface VerifyPaymentPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface GetPaymentsParams {
  page?: number;
  limit?: number;
}

// ── Billing API service ───────────────────────────────────────────────────────

export const billingApi = {
  getSummary: () =>
    api.get<Envelope<BillingSummary>>('/billing/summary').then(r => r.data),

  getPlans: () =>
    api.get<Envelope<Plan[]>>('/plans').then(r => r.data),

  getPayments: ({ page = 1, limit = 20 }: GetPaymentsParams = {}) =>
    api.get<Envelope<PaginatedPayments>>('/payments', { params: { page, limit } }).then(r => r.data),

  getCurrentSubscription: () =>
    api.get<Envelope<Subscription | null>>('/subscriptions/current').then(r => r.data),

  upgradeSubscription: ({ planId, billingCycle, autoRenew = true }: UpgradeSubscriptionPayload) =>
    api.post<Envelope<UpgradeSubscriptionResponse>>('/subscriptions/upgrade', {
      planId,
      billingCycle,
      autoRenew,
    }).then(r => r.data),

  subscribe: ({ planId, billingCycle, autoRenew = true }: UpgradeSubscriptionPayload) =>
    api.post<Envelope<UpgradeSubscriptionResponse>>('/subscriptions', {
      planId,
      billingCycle,
      autoRenew,
    }).then(r => r.data),

  cancelSubscription: () =>
    api.post('/subscriptions/cancel').then(r => r.data),

  verifyPayment: ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }: VerifyPaymentPayload) =>
    api.post<Envelope<{ success: boolean; message?: string }>>('/payments/verify', {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    }).then(r => r.data),
};