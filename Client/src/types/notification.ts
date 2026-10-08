/* ───────────────────────────────────────────────────────────────────────────
   Notification module types — mirrors the backend's Notification model and
   API envelope exactly (see Server/src/modules/notifications).
─────────────────────────────────────────────────────────────────────────── */

export type NotificationType = 'campaign' | 'billing' | 'whatsapp' | 'contact' | 'system';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/** Raw shape returned by the API / emitted over the `notification` socket event. */
export interface ApiNotification {
  _id: string;
  userId: string;
  type: NotificationType;
  event: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  metadata: Record<string, unknown>;
  read: boolean;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationListParams {
  page?: number;
  limit?: number;
  type?: NotificationType;
  read?: boolean;
}

export interface NotificationListData {
  notifications: ApiNotification[];
  totalNotifications: number;
  totalPages: number;
  currentPage: number;
  unreadCount: number;
}

export interface UnreadCountData {
  unreadCount: number;
}

export interface MarkAllReadData {
  modifiedCount: number;
}

export interface DeleteAllData {
  deletedCount: number;
}