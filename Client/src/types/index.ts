export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'tenant' | 'admin';
  tenantId?: string;
  createdAt: Date;
}

export interface Tenant {
  id: string;
  name: string;
  plan: Plan;
  whatsappConnected: boolean;
  whatsappNumber?: string;
  subscribers: number;
  messagesSent: number;
  createdAt: Date;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  messageLimit: number;
  contactLimit: number;
  campaignLimit: number;
  features: string[];
  highlighted?: boolean;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tags: string[];
  status: 'active' | 'inactive' | 'blocked';
  subscribedAt: Date;
  lastMessageAt?: Date;
  groupId?: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  contactCount: number;
  createdAt: Date;
}

export interface Template {
  id: string;
  name: string;
  category: 'marketing' | 'transactional' | 'otp';
  content: string;
  variables: string[];
  status: 'approved' | 'pending' | 'rejected';
  createdAt: Date;
}

export interface Campaign {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  audience: string[];
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';
  scheduledAt?: Date;
  sentAt?: Date;
  totalRecipients: number;
  delivered: number;
  read: number;
  replied: number;
  failed: number;
  createdAt: Date;
}

export interface Message {
  id: string;
  campaignId?: string;
  contactId: string;
  contactName: string;
  phone: string;
  content: string;
  status: 'sent' | 'delivered' | 'read' | 'replied' | 'failed';
  direction: 'outbound' | 'inbound';
  createdAt: Date;
}

export interface Notification {
  id: string;
  type: 'campaign' | 'billing' | 'whatsapp' | 'contact' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

export interface AnalyticsData {
  date: string;
  messagesSent: number;
  delivered: number;
  read: number;
  replied: number;
}

export interface Subscription {
  id: string;
  tenantId: string;
  tenantName: string;
  plan: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  currentPeriodEnd: Date;
  mrr: number;
  createdAt: Date;
}

export interface RevenueData {
  month: string;
  revenue: number;
  mrr: number;
  churn: number;
}

export interface PlatformUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'tenant' | 'admin';
  tenantId?: string;
  tenantName?: string;
  status: 'active' | 'inactive' | 'suspended';
  lastLoginAt?: Date;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'export' | 'import' | 'api_call';
  actor: {
    id: string;
    name: string;
    email: string;
  };
  resource: string;
  resourceId?: string;
  details?: string;
  ipAddress: string;
  timestamp: Date;
}
