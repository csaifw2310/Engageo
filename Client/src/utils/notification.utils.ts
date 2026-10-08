/* ───────────────────────────────────────────────────────────────────────────
   Shared notification presentation helpers.

   Centralises what TopNavigation.tsx and NotificationsPage.tsx each used to
   define locally (icon-per-type, target-route-per-type) plus the mapping
   from the backend's ApiNotification shape to the frontend's existing
   `Notification` type, so the rest of the app never has to think about the
   difference between the two.
─────────────────────────────────────────────────────────────────────────── */
import type { Notification } from '../types';
import type { ApiNotification, NotificationType } from '../types/notification';

/** Emoji glyph used in the compact bell dropdown (TopNavigation). */
export const notificationEmoji = (type: NotificationType | string): string => {
  switch (type) {
    case 'campaign':
      return '📢';
    case 'billing':
      return '💳';
    case 'whatsapp':
      return '💬';
    case 'contact':
      return '👥';
    case 'system':
      return '⚙️';
    default:
      return '🔔';
  }
};

/** Where clicking a notification of this type should navigate to. */
export const notificationTarget = (type: NotificationType | string): string => {
  switch (type) {
    case 'whatsapp':
      return '/conversations';
    case 'campaign':
      return '/campaigns';
    case 'billing':
      return '/billing';
    case 'contact':
      return '/contacts';
    default:
      return '/notifications';
  }
};

/** Relative "2m ago" / "3h ago" / "5d ago" formatting for compact UI. */
export const formatRelativeTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
};

/**
 * Map a backend ApiNotification onto the frontend's existing `Notification`
 * shape (types/index.ts), so AppStore.tsx can keep exposing exactly the
 * same public interface (`id`, `read`, `createdAt`, ...) that
 * NotificationsPage.tsx and TopNavigation.tsx already consume, while still
 * carrying the richer backend fields for anything that wants them.
 */
export function toClientNotification(
  n: ApiNotification
): Notification & { event: string; priority: string; metadata: Record<string, unknown> } {
  return {
    id: n._id,
    type: n.type,
    title: n.title,
    message: n.message,
    read: n.read,
    createdAt: new Date(n.createdAt),
    event: n.event,
    priority: n.priority,
    metadata: n.metadata,
  };
}