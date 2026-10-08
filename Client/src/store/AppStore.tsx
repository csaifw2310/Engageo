import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { Notification } from "../types";
import { authApi } from "../api/auth";
import { setAccessToken, clearAccessToken } from "../api/client";
import notificationApi from "../api/notificationApi";
import { useNotificationSocket } from "../hooks/useNotificationSocket";
import { toClientNotification } from "../utils/notification.utils";
import {
  getConversationPrefs,
  resetConversationPrefsStore,
} from "../store/conversationPrefsStore";
const notificationSound = new Audio("/sounds/notification_sound.mp3");
notificationSound.preload = "auto";

// ── Auth user shape (from backend) ────────────────────────────────────────────
export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  status: string;
  isEmailVerified: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  deleteNotification: (id: string) => void;
  addNotification: (n: Omit<Notification, "id" | "read" | "createdAt">) => void;
}

type AppState = AuthState & NotificationsState;

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const socketRef = useRef<any>(null);

  // Restore session on mount
  useEffect(() => {
    const restore = async () => {
      try {
        const res = await authApi.getMe();
        if (res.success && res.user) {
          setUser(res.user as AuthUser);
        }
      } catch {
        clearAccessToken();
      } finally {
        setIsLoading(false);
      }
    };
    restore();
  }, []);

  // Socket.IO for real-time notifications
  // Fetch persisted notifications (MongoDB-backed) once the user is known.
  // This is what makes notifications survive a refresh / offline period —
  // Socket.IO below is real-time delivery on top of this, never the source
  // of truth.
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await notificationApi.list({ limit: 50 });
        if (!cancelled && res.success) {
          setNotifications(res.data.notifications.map(toClientNotification));
        }
      } catch {
        // Non-fatal — the bell just stays empty until the next successful fetch.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?._id]);

  // Real-time delivery for persisted notifications — reuses the project's
  // existing Socket.IO connection via its own dedicated hook (see
  // useNotificationSocket.ts) rather than a second bespoke io() call.
  useNotificationSocket({
    enabled: !!user,
    onNotification: async (n) => {
      const clientNotif = toClientNotification(n);
      const conversationId = clientNotif.metadata?.conversationId as
        | string
        | undefined;

      if (conversationId) {
        const prefs = getConversationPrefs(conversationId);

        if (prefs.archived) return; // archived conv — ignore entirely
        if (prefs.muteNotifications) return; // muted — don't create it

        addNotificationInternal(clientNotif);

        if (!prefs.muteSound) {
          try {
            notificationSound.currentTime = 0;
            await notificationSound.play();
          } catch (err) {
            console.error("Play failed:", err);
          }
        }
        return;
      }

      // No conversationId on payload (e.g. campaign/billing/system notifications)
      // — fall back to old unfiltered behavior.
      addNotificationInternal(clientNotif);
      try {
        notificationSound.currentTime = 0;
        await notificationSound.play();
      } catch (err) {
        console.error("Play failed:", err);
      }
    },
  });

  function addNotificationInternal(
    n: Omit<Notification, "id" | "read" | "createdAt"> | Notification,
  ) {
    setNotifications((prev) => {
      const withId: Notification =
        "id" in n && n.id
          ? (n as Notification)
          : {
              id: `notif-${Date.now()}-${Math.random()}`,
              read: false,
              createdAt: new Date(),
              ...n,
            };
      // Guard against the rare double-delivery race (server row + local echo).
      if (prev.some((existing) => existing.id === withId.id)) return prev;
      return [withId, ...prev].slice(0, 50); // Keep last 50
    });
  }

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    if (!res.success) throw new Error(res.message ?? "Login failed");
    setAccessToken(res.accessToken);
    setUser(res.user as AuthUser);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await authApi.register({ name, email, password });
      if (!res.success) throw new Error(res.message ?? "Registration failed");
      setAccessToken(res.accessToken);
      setUser(res.user as AuthUser);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* Ignore errors on logout */
    } finally {
      clearAccessToken();
      setUser(null);
      setNotifications([]);
      resetConversationPrefsStore();
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await authApi.getMe();
    if (res.success && res.user) {
      setUser(res.user as AuthUser);
    }
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    notificationApi.markRead(id).catch(() => {
      // Best-effort — a failed sync just means it re-shows as unread on next fetch.
    });
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    notificationApi.markAllRead().catch(() => {
      // Best-effort — see markNotificationRead.
    });
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    notificationApi.removeAll().catch(() => {
      // Best-effort — a failed sync just means old rows reappear on next fetch.
    });
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    notificationApi.remove(id).catch(() => {
      // Best-effort — a failed sync just means it reappears on next fetch.
    });
  }, []);

  const addNotification = useCallback(
    (n: Omit<Notification, "id" | "read" | "createdAt">) => {
      addNotificationInternal(n);
    },
    [],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
        markNotificationRead,
        markAllNotificationsRead,
        clearNotifications,
        deleteNotification,
        addNotification,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function useAuth() {
  const {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    refreshUser,
  } = useApp();
  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    refreshUser,
  };
}

export function useNotifications() {
  const {
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    deleteNotification,
    addNotification,
  } = useApp();
  return {
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    deleteNotification,
    addNotification,
  };
}
