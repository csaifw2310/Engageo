import { Bell, Check, BarChart3, CreditCard, MessageSquare, Users, Trash2 } from 'lucide-react';
import { useNotifications } from '../store/AppStore';

export function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearNotifications,
  } = useNotifications();

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'campaign': return BarChart3;
      case 'billing': return CreditCard;
      case 'whatsapp': return MessageSquare;
      case 'contact': return Users;
      default: return Bell;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium">Notifications</h1>
          <p className="text-sm text-zinc-500">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllNotificationsRead} className="btn btn-secondary btn-sm">
              <Check className="w-4 h-4" />
              Mark all as read
            </button>
          )}
          {notifications.length > 0 && (
            <button onClick={clearNotifications} className="btn btn-secondary btn-sm">
              <Trash2 className="w-4 h-4" />
              Clear all
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Bell className="w-6 h-6 text-zinc-600" />
          </div>
          <p className="empty-state-title">No notifications</p>
          <p className="empty-state-description">You&apos;re all caught up!</p>
        </div>
      ) : (
        <div className="card divide-y divide-zinc-800/50">
          {notifications.map((notification) => {
            const TypeIcon = getTypeIcon(notification.type);
            return (
              <div
                key={notification.id}
                className={`p-4 flex gap-4 group ${!notification.read ? 'bg-zinc-800/20' : ''}`}
              >
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  <TypeIcon className="w-5 h-5 text-zinc-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className={`text-sm ${notification.read ? 'text-zinc-400' : 'font-medium'}`}>
                        {notification.title}
                      </p>
                      <p className="text-sm text-zinc-500 mt-0.5">{notification.message}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!notification.read && (
                        <button onClick={() => markNotificationRead(notification.id)} className="p-1" title="Mark as read">
                          <Check className="w-4 h-4 text-zinc-400" />
                        </button>
                      )}
                      <button onClick={() => deleteNotification(notification.id)} className="p-1" title="Delete">
                        <Trash2 className="w-4 h-4 text-zinc-500 hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-600 mt-2">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}