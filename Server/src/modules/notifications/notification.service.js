import Notification from './notification.model.js';
import ApiError from '../../utils/ApiError.js';
import { socketEmitter } from '../../core/socket/index.js';
import {
  NOTIFICATION_PAGINATION,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_MESSAGES,
} from './notification.constants.js';

/**
 * Notification service.
 *
 * Every method is tenant-scoped: it takes the authenticated `userId` and only
 * ever reads or writes documents owned by that user. There is no code path
 * that can reach another tenant's notifications.
 *
 * `create()` is the single write path used by every business event across the
 * app (see notification.events.js). It always persists to MongoDB first —
 * so offline users still receive the notification on next load — and only
 * THEN pushes a best-effort real-time event over the existing Socket.IO
 * connection. Socket.IO is delivery, not storage: if the user isn't
 * connected, the emit is simply a no-op and the row is already durable.
 */
class NotificationService {
  /**
   * Create a notification for a tenant and push it in real time.
   *
   * @param {string} userId
   * @param {object} data
   * @param {string} data.type      NOTIFICATION_TYPE value
   * @param {string} data.event     NOTIFICATION_EVENT value
   * @param {string} data.title
   * @param {string} data.message
   * @param {string} [data.priority=NOTIFICATION_PRIORITY.NORMAL]
   * @param {object} [data.metadata={}]
   * @returns {Promise<object>} the created notification
   */
  async create(userId, data) {
    const notification = await Notification.create({
      userId,
      type: data.type,
      event: data.event,
      title: data.title,
      message: data.message,
      priority: data.priority || NOTIFICATION_PRIORITY.NORMAL,
      metadata: data.metadata || {},
    });

    // Real-time delivery only — never the source of truth. Never throws: a
    // socket failure must not roll back (or even affect) the persisted
    // notification.
    try {
      socketEmitter.notification(String(userId), notification.toObject());
    } catch {
      // Swallow — the notification is already durably stored.
    }

    return notification;
  }

  /**
   * List a tenant's notifications with optional type/read filters and
   * pagination. Returns the project's standard list envelope.
   */
  async list(userId, options = {}) {
    const page = Math.max(
      parseInt(options.page, 10) || NOTIFICATION_PAGINATION.DEFAULT_PAGE,
      1
    );
    const limit = Math.min(
      Math.max(parseInt(options.limit, 10) || NOTIFICATION_PAGINATION.DEFAULT_LIMIT, 1),
      NOTIFICATION_PAGINATION.MAX_LIMIT
    );
    const skip = (page - 1) * limit;

    // Tenant scope is ALWAYS applied first.
    const filter = { userId };

    if (options.type) filter.type = options.type;
    if (options.read !== undefined) {
      filter.read = options.read === true || options.read === 'true';
    }

    const [notifications, totalNotifications, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId, read: false }),
    ]);

    return {
      notifications,
      totalNotifications,
      totalPages: Math.ceil(totalNotifications / limit) || 0,
      currentPage: page,
      unreadCount,
    };
  }

  /** Unread count only — cheap call for the bell badge on every page load. */
  async getUnreadCount(userId) {
    const unreadCount = await Notification.countDocuments({ userId, read: false });
    return { unreadCount };
  }

  /** Fetch a single owned notification (404 if not found OR not owned). */
  async getById(userId, id) {
    const notification = await Notification.findOne({ _id: id, userId }).lean();
    if (!notification) throw new ApiError(404, NOTIFICATION_MESSAGES.NOT_FOUND);
    return notification;
  }

  /** Mark a single owned notification as read. Idempotent. */
  async markRead(userId, id) {
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { $set: { read: true, readAt: new Date() } },
      { new: true }
    );
    if (!notification) throw new ApiError(404, NOTIFICATION_MESSAGES.NOT_FOUND);
    return notification;
  }

  /** Mark every unread notification owned by the tenant as read. */
  async markAllRead(userId) {
    const result = await Notification.updateMany(
      { userId, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    return { modifiedCount: result.modifiedCount || 0 };
  }

  /** Delete an owned notification. */
  async remove(userId, id) {
    const notification = await Notification.findOneAndDelete({ _id: id, userId });
    if (!notification) throw new ApiError(404, NOTIFICATION_MESSAGES.NOT_FOUND);
    return notification;
  }

  /** Delete every notification owned by the tenant (e.g. "clear all"). */
  async removeAll(userId) {
    const result = await Notification.deleteMany({ userId });
    return { deletedCount: result.deletedCount || 0 };
  }
}

export default new NotificationService();