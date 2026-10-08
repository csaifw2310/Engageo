import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Search, ChevronDown, LogOut, Settings, MessageSquare, CheckCheck, Trash2 } from 'lucide-react';
import { useAuth, useNotifications } from '../store/AppStore';
import { notificationEmoji, notificationTarget } from '../utils/notification.utils';

export function TopNavigation({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead, deleteNotification } = useNotifications();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const prevUnreadRef = useRef(0);

  // Animate the bell when new notification arrives
  const [bellBounce, setBellBounce] = useState(false);
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      setBellBounce(true);
      setTimeout(() => setBellBounce(false), 600);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userRef.current && !userRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    logout();
    navigate('/login');
  };

  const handleNotifClick = (n: any) => {
    markNotificationRead(n.id);
    setShowNotifications(false);
    navigate(notificationTarget(n.type));
  };

  return (
    <header className="fixed top-0 right-0 left-0 md:left-56 h-14 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl z-40">
      <div className="flex items-center justify-between h-full px-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-md hover:bg-zinc-800/50 transition-colors"
          >
            <MessageSquare className="w-5 h-5 text-zinc-400" />
          </button>

          <div className="hidden md:flex items-center gap-1">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-all">
              <Search className="w-4 h-4" />
              <span>Search...</span>
              <kbd className="px-1.5 py-0.5 text-[10px] rounded bg-zinc-800 text-zinc-500 border border-zinc-700">
                ⌘K
              </kbd>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile bell */}
          <Link
            to="/notifications"
            className="md:hidden p-2 rounded-md hover:bg-zinc-800/50 transition-colors relative"
          >
            <Bell className="w-5 h-5 text-zinc-400" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-white text-zinc-950 text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>

          {/* Desktop notification dropdown */}
          <div ref={notifRef} className="hidden md:block relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`relative p-2 rounded-md hover:bg-zinc-800/50 transition-all ${bellBounce ? 'scale-110' : ''}`}
              style={{ transition: 'transform 0.15s ease' }}
            >
              <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-white' : 'text-zinc-400'}`} />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-white text-zinc-950 text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden z-50">
                <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">{unreadCount} new</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllNotificationsRead}
                        className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                      >
                        <CheckCheck className="w-3 h-3" />
                        Mark all read
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-zinc-600">
                      <Bell className="w-6 h-6 mb-2 opacity-30" />
                      <p className="text-xs">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.slice(0, 10).map(n => (
                      <div
                        key={n.id}
                        className={`w-full flex items-start gap-1 pr-2 text-left hover:bg-zinc-800/50 transition-colors border-b border-zinc-800/50 last:border-0 group ${!n.read ? 'bg-zinc-800/20' : ''}`}
                      >
                        <button
                          onClick={() => handleNotifClick(n)}
                          className="flex-1 min-w-0 flex gap-3 p-3 text-left"
                        >
                          <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-sm shrink-0">
                            {notificationEmoji(n.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{n.title}</p>
                            <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5">{n.message}</p>
                            <p className="text-[10px] text-zinc-600 mt-1">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </button>
                        <div className="flex items-center gap-1.5 shrink-0 pt-3.5">
                          {!n.read && <span className="w-2 h-2 rounded-full bg-white shrink-0" />}
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                            className="p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-zinc-500 hover:text-red-400" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {notifications.length > 0 && (
                  <div className="p-2 border-t border-zinc-800">
                    <Link
                      to="/notifications"
                      onClick={() => setShowNotifications(false)}
                      className="block text-center text-xs text-zinc-500 hover:text-white py-1 transition-colors"
                    >
                      View all notifications
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          <div ref={userRef} className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 rounded-md hover:bg-zinc-800/50 transition-colors"
            >
              <div className="w-7 h-7 rounded-md bg-zinc-200 flex items-center justify-center shrink-0">
                <span className="text-xs font-medium text-zinc-900">{user?.name?.charAt(0) || 'U'}</span>
              </div>
              <span className="hidden md:block text-sm max-w-24 truncate">{user?.name}</span>
              <ChevronDown className="hidden md:block w-4 h-4 text-zinc-500 shrink-0" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 max-w-[90vw] rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden">
                <div className="p-3 border-b border-zinc-800">
                  <p className="text-sm font-medium truncate">{user?.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                </div>
                <div className="p-1.5">
                  <Link
                    to="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="dropdown-item"
                  >
                    <Settings className="w-4 h-4 text-zinc-500" />
                    <span>Settings</span>
                  </Link>
                  <button onClick={handleLogout} className="dropdown-item text-red-400">
                    <LogOut className="w-4 h-4" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}