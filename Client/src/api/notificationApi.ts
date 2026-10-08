import api from './client';
import type {
  ApiNotification,
  NotificationListParams,
  NotificationListData,
  UnreadCountData,
  MarkAllReadData,
  DeleteAllData,
} from '../types/notification';

// ── Envelope wrapper (every backend response uses this shape) ──────────────────
interface Envelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

/**
 * Notification API layer.
 *
 * Every call is tenant-scoped implicitly via the Bearer token attached by
 * `api`'s request interceptor (see api/client.ts) — no userId is ever passed
 * from the client. Mirrors the REST surface of
 * Server/src/modules/notifications/notification.routes.js exactly.
 */
export const notificationApi = {
  list: (params?: NotificationListParams) =>
    api.get<Envelope<NotificationListData>>('/notifications', { params }).then((r) => r.data),

  getUnreadCount: () =>
    api.get<Envelope<UnreadCountData>>('/notifications/unread-count').then((r) => r.data),

  getById: (id: string) =>
    api.get<Envelope<ApiNotification>>(`/notifications/${id}`).then((r) => r.data),

  markRead: (id: string) =>
    api.patch<Envelope<ApiNotification>>(`/notifications/${id}/read`).then((r) => r.data),

  markAllRead: () =>
    api.patch<Envelope<MarkAllReadData>>('/notifications/read-all').then((r) => r.data),

  remove: (id: string) =>
    api.delete<Envelope<null>>(`/notifications/${id}`).then((r) => r.data),

  removeAll: () =>
    api.delete<Envelope<DeleteAllData>>('/notifications').then((r) => r.data),
};

export default notificationApi;