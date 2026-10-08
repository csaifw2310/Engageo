import type React from "react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useTheme } from "../../../lib/theme"; // adjust path
import {
  conversationsApi,
  contactsApi,
  savedRepliesApi,
} from "../../../api/resources";
import { useSearchParams } from "react-router-dom";
import { useSocket } from "../../../hooks/useSocket";
import { setConversationPrefs } from "../../../store/conversationPrefsStore";
import type {
  Conversation,
  ConversationFilter,
  ConversationProfile,
  ProfileMap,
  SavedReply,
  Toast,
  ToastTone,
  HeaderActionKey,
  MessageActionKey,
  MessageDayGroup,
} from "../../../types/conversation";
import type {
  ChatMessage,
  Attachment,
  OutgoingExtras,
} from "../../../types/message";
import type {
  NewMessagePayload,
  TypingPayload,
  OnlineStatusPayload,
  ReadReceiptPayload,
  UnreadUpdatePayload,
} from "../../../types/socket";
import type { RecordedVoiceNote } from "../VoiceRecorder";
import {
  APPEARANCE_PRESETS,
  type ChatAppearanceKey,
} from "../AppearanceSelector";

/* ── Attachment helpers ──────────────────────────────────────────────── */
/**
 * Map a browser File.type onto the WhatsApp Cloud API message type. Anything
 * that isn't image/video/audio is a `document` — that covers pdf, docx, xlsx,
 * csv and the rest, and matches what the backend's chatAttachmentFileFilter
 * already accepts.
 */
export const mediaTypeForMime = (mime: string): string => {
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  return "document";
};

/* ── Shared types (used across UI modules too) ───────────────────────── */
export type IconType = React.ComponentType<{ style?: React.CSSProperties }>;
export type CSS = React.CSSProperties;
export type Profile = ConversationProfile;
export type SetProfile = (
  updater: Profile | ((prev: Profile) => Profile),
) => void;
export type TypingEntry = { name: string; ts: number };
export type TypingState = Record<string, TypingEntry | undefined>;
export type PillTone =
  | "neutral"
  | "accent"
  | "violet"
  | "success"
  | "danger"
  | "warning"
  | "info";
export interface FilterDef {
  key: ConversationFilter;
  label: string;
  icon: IconType;
}

/* Per-conversation notification preferences (Task 3).
   Previously these lived only in the global `InboxSettings` state; now
   every conversation owns its own { notifications, sound } pair, the same
   way `mutedConvIds` / `archivedConvIds` already work per-conversation. */
export interface ConvNotifPrefs {
  notifications: boolean;
  sound: boolean;
}
export const DEFAULT_CONV_NOTIF_PREFS: ConvNotifPrefs = {
  notifications: true,
  sound: false,
};

export const APPEARANCE_STORAGE_KEY = "engageo:chatAppearance";
export const SAVED_REPLIES_STORAGE_KEY = "engageo:savedReplies";

export const LIST_POLL_MS = 3_000;
export const MSG_POLL_MS = 2_000;
export const TYPING_EXPIRE_MS = 5_000;

export const DEFAULT_SAVED_REPLIES: SavedReply[] = [
  {
    id: "r1",
    title: "Greeting",
    body: "Hi! Thanks for reaching out — how can I help you today?",
  },
  {
    id: "r2",
    title: "Order status",
    body: "Let me check on that for you — one moment please.",
  },
  {
    id: "r3",
    title: "Closing",
    body: "Glad we could help! Reach out anytime if you need anything else.",
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   TIME HELPERS
───────────────────────────────────────────────────────────────────────────── */
export function fmtTime(d: string | number | Date) {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  const now = new Date();
  const same = dt.toDateString() === now.toDateString();
  return same
    ? dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : dt.toLocaleDateString([], { day: "2-digit", month: "short" }) +
        " · " +
        dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
export function fmtRelative(d?: string | number | Date | null) {
  if (!d) return "—";
  const dt = new Date(d),
    now = new Date();
  const diff = Math.max(0, now.getTime() - dt.getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return dt.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
export function dayLabel(d: string | number | Date) {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  const now = new Date();
  const yes = new Date(now);
  yes.setDate(now.getDate() - 1);
  if (dt.toDateString() === now.toDateString()) return "Today";
  if (dt.toDateString() === yes.toDateString()) return "Yesterday";
  return dt.toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function groupByDay(msgs: ChatMessage[]): MessageDayGroup[] {
  const out: MessageDayGroup[] = [];
  let last = "";
  for (const m of msgs) {
    const l = dayLabel(m.createdAt);
    if (l !== last) {
      out.push({ label: l, msgs: [m] });
      last = l;
    } else out[out.length - 1].msgs.push(m);
  }
  return out;
}

/* Converts a "#RRGGBB" hex color to an "rgba(r,g,b,a)" string. Falls back to
   fully transparent for an empty/invalid input (used for the "classic"
   appearance, which should apply no tint at all). */
export function hexToRgba(hex: string, alpha: number): string {
  if (!hex) return "rgba(0,0,0,0)";
  const clean = hex.replace("#", "");
  const bigint = parseInt(
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean,
    16,
  );
  if (isNaN(bigint)) return "rgba(0,0,0,0)";
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function downloadText(
  filename: string,
  content: string,
  mime = "text/plain",
) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function statusRank(s: string): number {
  const v = s.toLowerCase();
  if (v === "read") return 4;
  if (v === "delivered") return 3;
  if (v === "sent" || v === "queued") return 2;
  if (v === "sending" || v === "pending") return 1;
  return 0;
}

/* Merge a list of messages — authority = server, keep optimistic tmp entries not yet confirmed.
   IMPORTANT: for real (non-tmp/note) messages that exist in both `base` and
   `incoming`, don't blindly take the incoming copy — a poll or an
   older-messages-page refetch can race with a socket read-receipt that
   already bumped the local status (e.g. sent -> delivered). Keep whichever
   status ranks higher so ticks never visually downgrade. */
export function mergeMessages(
  base: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const m of incoming) byId.set(String(m._id), m);
  for (const m of base) {
    const key = String(m._id);
    if (key.startsWith("tmp-") || key.startsWith("note-")) {
      if (!byId.has(key)) byId.set(key, m);
      continue;
    }
    const existing = byId.get(key);
    if (!existing) {
      byId.set(key, m);
    } else if (
      m.status &&
      statusRank(m.status) > statusRank(existing.status || "")
    ) {
      byId.set(key, { ...existing, status: m.status });
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

/* Bubble a conversation to the top and update preview fields */
export function bubbleConv(
  list: Conversation[],
  id: string,
  patch: Partial<Conversation>,
): Conversation[] {
  const idx = list.findIndex((c) => c._id === id);
  if (idx === -1) return list;
  const updated = { ...list[idx], ...patch };
  const rest = list.filter((_, i) => i !== idx);
  return [updated, ...rest];
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN LOGIC HOOK — single source of truth for all ConversationPage behavior.
   ConversationPage.tsx calls this and passes the returned values down into
   the presentational modules (Header / Body / Composer / UI).
───────────────────────────────────────────────────────────────────────────── */
export function useConversationPageLogic() {
  /* ── Core state ────────────────────────────────────────────────────── */
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── Pagination for "load older messages on scroll-up" ────────────── */
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const pageRef = useRef(1);
  const hasMoreOlderRef = useRef(true);
  const loadingOlderRef = useRef(false);
  const loadOlderMessagesRef = useRef<() => void>(() => {});

  useEffect(() => {
    hasMoreOlderRef.current = hasMoreOlder;
  }, [hasMoreOlder]);
  useEffect(() => {
    loadingOlderRef.current = loadingOlder;
  }, [loadingOlder]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [composerMode, setComposerMode] = useState<"reply" | "note">("reply");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [inThreadSearch, setInThreadSearch] = useState(false);
  const [threadQuery, setThreadQuery] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [forwardTarget, setForwardTarget] = useState<ChatMessage | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [infoIds, setInfoIds] = useState<Record<string, boolean>>({});

  const [pinnedConvIds, setPinnedConvIds] = useState<Set<string>>(new Set());
  const [mutedConvIds, setMutedConvIds] = useState<Set<string>>(new Set());
  const [archivedConvIds, setArchivedConvIds] = useState<Set<string>>(
    new Set(),
  );
  const [pinnedMsgIds, setPinnedMsgIds] = useState<Set<string>>(new Set());
  const [starredMsgIds, setStarredMsgIds] = useState<Set<string>>(new Set());
  const [profiles, setProfiles] = useState<ProfileMap>({});

  /* Task 3 — per-conversation notification + sound preferences */
  const [convNotifPrefs, setConvNotifPrefs] = useState<
    Record<string, ConvNotifPrefs>
  >({});

  /* Task 4 — chat bubble appearance (independent from app dark/light theme) */
  const [appearance, setAppearance] = useState<ChatAppearanceKey>(() => {
    try {
      const saved = localStorage.getItem(APPEARANCE_STORAGE_KEY);
      return (saved as ChatAppearanceKey) || "classic";
    } catch {
      return "classic";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance);
    } catch {
      /* localStorage may be unavailable — appearance still works for this session */
    }
  }, [appearance]);

  // NEW
  const [savedReplies, setSavedReplies] = useState<SavedReply[]>([]);

  // Load saved replies from the backend once on mount.
  // NEW
  useEffect(() => {
    (async () => {
      try {
        const r = await savedRepliesApi.list();
        const mapped: SavedReply[] = (r.data ?? []).map((x) => ({
          id: x._id,
          title: x.title,
          body: x.body,
        }));
        setSavedReplies(mapped);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  /* ── Toast helper ─────────────────────────────────────────────────── */
  const toast = useCallback((msg: string, tone: ToastTone = "primary") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  // NEW
  const addSavedReply = useCallback(
    async (title: string, body: string) => {
      try {
        const r = await savedRepliesApi.create(title, body);
        const created: SavedReply = {
          id: r.data._id,
          title: r.data.title,
          body: r.data.body,
        };
        setSavedReplies((prev) => [...prev, created]);
        toast("Saved reply added");
      } catch (e) {
        console.error(e);
        toast("Failed to save reply", "danger");
      }
    },
    [toast],
  );

  const deleteSavedReply = useCallback(
    async (id: string) => {
      const snapshot = savedReplies;
      setSavedReplies((prev) => prev.filter((r) => r.id !== id));
      try {
        await savedRepliesApi.delete(id);
        toast("Saved reply removed");
      } catch (e) {
        console.error(e);
        setSavedReplies(snapshot); // rollback — backend didn't confirm delete
        toast("Failed to remove reply", "danger");
      }
    },
    [toast, savedReplies],
  );

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingState>({});
  const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({});
  /* Single source of truth for theme — shared across the whole app via lib/theme */
  const [theme] = useTheme();
  /* Presentation-only UI state (fullscreen "movie mode" for the whole widget) */
  const [isFullscreen, setIsFullscreen] = useState(false);

  /* ── Refs ─────────────────────────────────────────────────────────── */
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const snappedConvIdRef = useRef<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // Live refs so socket handlers never capture stale state
  const selectedRef = useRef(selected);
  const msgsRef = useRef(msgs);
  const profilesRef = useRef(profiles);
  const connectedRef = useRef(false);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  useEffect(() => {
    msgsRef.current = msgs;
  }, [msgs]);
  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  /* ── Stable emitRead ref ──────────────────────────────────────────── */
  const emitReadRef = useRef<((messageId: string) => void) | null>(null);

  /* ── Socket handlers (stable — read only from refs) ──────────────── */
  const handleNewMessage = useCallback((data: NewMessagePayload) => {
    const sel = selectedRef.current;
    const isCurrentConv = data.conversationId === sel?._id;

    if (isCurrentConv) {
      setMsgs((prev) => {
        // Already have this real message → skip
        if (prev.find((m) => String(m._id) === String(data.message._id)))
          return prev;
        // Remove matching optimistic tmp placeholder
        const filtered = prev.filter((m) => {
          const key = String(m._id);
          if (!key.startsWith("tmp-")) return true;
          // Match by direction + content to drop the optimistic echo
          return !(
            m.direction === data.message.direction &&
            m.content === data.message.content
          );
        });
        return [...filtered, data.message].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });
      // Emit read receipt for inbound messages
      if (data.message.direction === "inbound") {
        emitReadRef.current?.(data.message._id);
      }
    }

    // Update conversation list: bubble to top, update preview, manage unread.
    //
    // Only INBOUND messages can raise the unread badge. The server emits
    // new_message to the whole user room for outbound sends too, so without
    // this check your own message marks your own chat unread whenever the
    // echo lands while a different conversation is selected — another open
    // tab, another device, or simply switching chats right after sending.
    const isInbound = data.message.direction === "inbound";
    setConvs((prev) =>
      bubbleConv(prev, data.conversationId, {
        lastMessage: data.message.content,
        lastMessageAt: data.message.createdAt,
        unreadCount: isCurrentConv
          ? 0
          : isInbound
            ? (prev.find((c) => c._id === data.conversationId)?.unreadCount ??
                0) + 1
            : (prev.find((c) => c._id === data.conversationId)?.unreadCount ??
              0),
      }),
    );
  }, []); // stable — reads only via refs

  const handleTyping = useCallback((data: TypingPayload) => {
    setTypingUsers((prev) => ({
      ...prev,
      [data.conversationId]: data.isTyping
        ? { name: data.userName || "Customer", ts: Date.now() }
        : undefined,
    }));
  }, []);

  const handleOnlineStatus = useCallback((data: OnlineStatusPayload) => {
    setOnlineUsers((prev) => ({ ...prev, [data.conversationId]: data.online }));
  }, []);

  const handleReadReceipt = useCallback((data: ReadReceiptPayload) => {
    const incoming = String(data.status || "read").toLowerCase();
    setMsgs((prev) =>
      prev.map((m: ChatMessage) => {
        if (String(m._id) !== String(data.messageId)) return m;
        const cur = String(m.status || "").toLowerCase();
        if (statusRank(incoming) <= statusRank(cur)) return m;
        return { ...m, status: incoming };
      }),
    );
  }, []);

  const handleUnreadUpdate = useCallback((data: UnreadUpdatePayload) => {
    setConvs((prev) =>
      prev.map((c) => {
        if (c._id !== data.conversationId) return c;
        return {
          ...c,
          ...(data.unreadCount !== undefined && {
            unreadCount: data.unreadCount,
          }),
          ...(data.lastMessage !== undefined && {
            lastMessage: data.lastMessage,
          }),
          ...(data.lastMessageAt !== undefined && {
            lastMessageAt: data.lastMessageAt,
          }),
        };
      }),
    );
  }, []);

  const { connected, emitTyping, emitRead } = useSocket({
    selectedId: selected?._id,
    onNewMessage: handleNewMessage,
    onTyping: handleTyping,
    onOnlineStatus: handleOnlineStatus,
    onReadReceipt: handleReadReceipt,
    onUnreadUpdate: handleUnreadUpdate,
  });

  // Keep refs current
  useEffect(() => {
    emitReadRef.current = emitRead;
  }, [emitRead]);
  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);

  /* ── Expire stale typing indicators ──────────────────────────────── */
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        let changed = false;
        const next: TypingState = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v && now - v.ts > TYPING_EXPIRE_MS) {
            changed = true;
          } else {
            next[k] = v;
          }
        }
        return changed ? next : prev;
      });
    }, 2_000);
    return () => clearInterval(interval);
  }, []);

  /* ── Keyboard shortcuts ───────────────────────────────────────────── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const ctrl = e.metaKey || e.ctrlKey;
      if (ctrl && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen(true);
      }
      if (ctrl && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarCollapsed((v) => !v);
      }
      if (ctrl && e.key === "\\") {
        e.preventDefault();
        setRightCollapsed((v) => !v);
      }
      if (ctrl && e.shiftKey && e.key.toUpperCase() === "F") {
        e.preventDefault();
        setFocusMode((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (focusMode) {
      setSidebarCollapsed(true);
      setRightCollapsed(true);
    } else {
      setSidebarCollapsed(false);
      setRightCollapsed(false);
    }
  }, [focusMode]);

  /* ── Exit fullscreen "movie mode" with Esc ───────────────────────── */
  useEffect(() => {
    if (!isFullscreen) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setIsFullscreen(false);
    }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [isFullscreen]);

  /* ── Textarea auto-resize ─────────────────────────────────────────── */
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [draft]);

  /* ── Draft typing indicator ───────────────────────────────────────── */
  useEffect(() => {
    if (!connected) return;
    if (draft) {
      emitTyping(true);
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => emitTyping(false), 2000);
    } else {
      emitTyping(false);
    }
    return () => clearTimeout(typingTimerRef.current);
  }, [draft, connected, emitTyping]);

  /* ── Scroll helpers ───────────────────────────────────────────────── */
  const [scrollDepth, setScrollDepth] = useState(1);
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60);

    const max = el.scrollHeight - el.clientHeight;
    setScrollDepth(max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 1);

    if (
      el.scrollTop < 80 &&
      hasMoreOlderRef.current &&
      !loadingOlderRef.current
    ) {
      loadOlderMessagesRef.current();
    }
  }, []);

  const goBottom = useCallback((instant = false) => {
    if (instant) {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    } else {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  /* ── Instant snap to bottom on first paint of a newly-opened thread ──
     Runs in useLayoutEffect so scrollTop is set BEFORE the browser paints —
     this is what prevents the visible top→bottom jump. */
  useLayoutEffect(() => {
    if (!selected) return;
    const alreadySnapped = snappedConvIdRef.current === selected._id;
    if (!alreadySnapped && msgs.length > 0) {
      goBottom(true);
      snappedConvIdRef.current = selected._id;
    }
  }, [selected, msgs, goBottom]);

  /* ── Smooth auto-scroll only for messages arriving into a thread
     that's already open and already snapped ───────────────────────── */
  const prevMsgCountRef = useRef(0);
  useEffect(() => {
    const prev = prevMsgCountRef.current;
    const cur = msgs.length;
    prevMsgCountRef.current = cur;
    const alreadySnapped = snappedConvIdRef.current === selected?._id;
    if (alreadySnapped && cur > prev && atBottom) goBottom(false);
  }, [msgs.length, atBottom, goBottom, selected?._id]);

  /* ── API ──────────────────────────────────────────────────────────── */
  const loadConvs = useCallback(async (initial = false) => {
    try {
      const r = await conversationsApi.list();
      const list: Conversation[] = r.data?.conversations ?? r.data ?? [];
      setConvs(list);

      // Hydrate real per-conversation prefs from the backend — without this,
      // every reload/remount falls back to DEFAULT_CONV_NOTIF_PREFS regardless
      // of what's actually saved.
      setConvNotifPrefs((prev) => {
        const next = { ...prev };
        list.forEach((c: any) => {
          next[c._id] = {
            notifications: !c.preferences?.muteNotifications,
            sound: !c.preferences?.muteSound,
          };
        });
        return next;
      });

      // Mirror into the shared prefs store too, for AppProvider's socket filter.
      list.forEach((c: any) => {
        setConversationPrefs(c._id, {
          archived: !!c.isArchived,
          muteNotifications: !!c.preferences?.muteNotifications,
          muteSound: !!c.preferences?.muteSound,
        });
      });
    } catch (e) {
      console.error(e);
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  const loadMsgs = useCallback(async (id: string, markRead = false) => {
    try {
      const r = await conversationsApi.getMessages(id, { page: 1 });
      const incoming: ChatMessage[] = r.data?.messages ?? r.data ?? [];
      const totalPages: number = r.data?.totalPages ?? 1;
      pageRef.current = 1;
      setHasMoreOlder(totalPages > 1);
      setMsgs((prev) => mergeMessages(prev, incoming));
      if (markRead) {
        await conversationsApi.markRead(id);
        setConvs((p) =>
          p.map((c) => (c._id === id ? { ...c, unreadCount: 0 } : c)),
        );
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadOlderMessages = useCallback(async () => {
    const sel = selectedRef.current;
    if (!sel || loadingOlderRef.current || !hasMoreOlderRef.current) return;

    loadingOlderRef.current = true;
    setLoadingOlder(true);

    const nextPage = pageRef.current + 1;
    const el = scrollRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;
    const prevScrollTop = el?.scrollTop ?? 0;

    try {
      const r = await conversationsApi.getMessages(sel._id, { page: nextPage });
      const incoming: ChatMessage[] = r.data?.messages ?? [];
      const totalPages: number = r.data?.totalPages ?? nextPage;

      if (incoming.length === 0) {
        setHasMoreOlder(false);
      } else {
        setMsgs((prev) => mergeMessages(prev, incoming));
        pageRef.current = nextPage;
        setHasMoreOlder(nextPage < totalPages);

        // scroll jump na ho isliye position restore karo
        requestAnimationFrame(() => {
          if (el) {
            const newScrollHeight = el.scrollHeight;
            el.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
          }
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOlder(false);
      loadingOlderRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadOlderMessagesRef.current = loadOlderMessages;
  }, [loadOlderMessages]);

  const ensureProfile = useCallback((conv: Conversation) => {
    setProfiles((p) =>
      p[conv._id]
        ? p
        : {
            ...p,
            [conv._id]: {
              name: conv.displayName || "",
              tags: conv.labels || [],
              notes: conv.internalNotes || "",
              customFields: [],
              stats: {
                totalMessages: conv.totalMessages,
                firstConversationAt: conv.firstMessageAt,
                lastActivityAt: conv.lastMessageAt,
                lastTemplate: conv.lastTemplate,
              },
              campaigns: conv.campaigns || [],
              activity: conv.activity || [
                {
                  label: "Conversation started",
                  at: conv.firstMessageAt || conv.lastMessageAt,
                },
              ],
            },
          },
    );
  }, []);

  const pick = useCallback(
    (conv: Conversation) => {
      const isSameConv = selectedRef.current?._id === conv._id;

      if (!isSameConv) {
        if (snappedConvIdRef.current !== conv._id) {
          snappedConvIdRef.current = null;
        }
        setMsgs([]); // only clear when actually switching threads
      }

      setSelected(conv);
      setInThreadSearch(false);
      setReplyTo(null);
      ensureProfile(conv);
      loadMsgs(conv._id, (conv.unreadCount ?? 0) > 0);
    },
    [ensureProfile, loadMsgs],
  );

  useEffect(() => {
    loadConvs(true);
  }, [loadConvs]);

  /* ── Open a specific contact from /conversations?phone=... ────────── */
  const openTargetRef = useRef(false);

  useEffect(() => {
    if (loading || openTargetRef.current) return;

    const phone = searchParams.get("phone");
    if (!phone) return;

    openTargetRef.current = true;
    const name = searchParams.get("name") || undefined;

    (async () => {
      try {
        const resp = await conversationsApi.findOrCreate({
          phoneNumber: phone,
          displayName: name,
        });

        const conv = (resp?.data ?? resp) as Conversation;

        await loadConvs(false); // Refresh list
        pick(conv);
      } catch (e) {
        console.error(e);
        toast("Could not open this conversation", "danger");
      }

      setSearchParams({}, { replace: true });
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, convs, searchParams]);

  /* ── Polling: fallback when socket is disconnected ────────────────── */
  useEffect(() => {
    const i = setInterval(() => {
      if (!connectedRef.current) loadConvs(false);
    }, LIST_POLL_MS);
    return () => clearInterval(i);
  }, [loadConvs]);

  useEffect(() => {
    if (!selected?._id) return;
    const id = selected._id;
    const i = setInterval(() => {
      if (!connectedRef.current) loadMsgs(id, false);
    }, MSG_POLL_MS);
    return () => clearInterval(i);
  }, [selected?._id, loadMsgs]);

  /* ── Derived ──────────────────────────────────────────────────────── */
  const profile = useMemo<ConversationProfile>(
    () =>
      selected
        ? (profiles[selected._id] ?? { name: "", tags: [], customFields: [] })
        : { name: "", tags: [], customFields: [] },
    [selected, profiles],
  );

  const setProfile = useCallback<SetProfile>((updater) => {
    const sid = selectedRef.current?._id;
    if (!sid) return;
    setProfiles((p) => ({
      ...p,
      [sid]:
        typeof updater === "function"
          ? (updater as (prev: Profile) => Profile)(
              p[sid] ?? { tags: [], customFields: [] },
            )
          : updater,
    }));
  }, []);

  const groupedMsgs = useMemo(
    () =>
      groupByDay(
        inThreadSearch && threadQuery
          ? msgs.filter((m) =>
              (m.content || "")
                .toLowerCase()
                .includes(threadQuery.toLowerCase()),
            )
          : msgs,
      ),
    [msgs, inThreadSearch, threadQuery],
  );

  const visibleMsgCount = useMemo(
    () => groupedMsgs.reduce((sum, g) => sum + g.msgs.length, 0),
    [groupedMsgs],
  );

  const pinnedMsgObjs = useMemo(
    () => msgs.filter((m) => pinnedMsgIds.has(m._id)),
    [msgs, pinnedMsgIds],
  );

  const isTyping = selected ? typingUsers[selected._id] : undefined;

  // Enrich conversation list with local state (archived, online)
  const convsList = useMemo(
    () =>
      convs.map((c) => ({
        ...c,
        archived: archivedConvIds.has(c._id),
        online: onlineUsers[c._id] ?? c.online,
      })),
    [convs, archivedConvIds, onlineUsers],
  );

  /* ── Send ─────────────────────────────────────────────────────────── */
  const performSend = useCallback(
    async (
      targetId: string,
      text: string,
      extra: OutgoingExtras = {},
      media?: {
        mediaUrl: string;
        mediaType: string;
        durationSec?: number;
        filename?: string;
        fileSize?: number;
      } | null,
    ): Promise<boolean> => {
      const tmp = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const isCurrent = targetId === selectedRef.current?._id;
      if (isCurrent) {
        setMsgs((p) => [
          ...p,
          {
            _id: tmp,
            direction: "outbound",
            content: text,
            status: "sending",
            createdAt: new Date().toISOString(),
            ...extra,
          },
        ]);
      }
      try {
        const r = await conversationsApi.sendMessage(targetId, text, media);
        const real: ChatMessage | undefined = r?.data?.data?.message;
        if (isCurrent) {
          setMsgs((p) => {
            // If socket already delivered the real message, just drop the tmp
            if (real && p.find((m) => String(m._id) === String(real._id))) {
              return p.filter((m) => m._id !== tmp);
            }
            return p.map((m) =>
              m._id === tmp
                ? real
                  ? { ...real, ...extra }
                  : { ...m, status: "sent" }
                : m,
            );
          });
        }
        // Bubble conversation to top on send
        setConvs((p) =>
          bubbleConv(p, targetId, {
            lastMessage: text,
            lastMessageAt: new Date().toISOString(),
          }),
        );
        return true;
      } catch {
        if (isCurrent)
          setMsgs((p) =>
            p.map((m) => (m._id === tmp ? { ...m, status: "failed" } : m)),
          );
        return false;
      }
    },
    [],
  );

  const send = useCallback(async () => {
    const text = draft.trim();
    const sel = selectedRef.current;
    if ((!text && !attachment) || !sel || sending) return;

    if (composerMode === "note") {
      setMsgs((p) => [
        ...p,
        {
          _id: `note-${Date.now()}`,
          direction: "note",
          content: text,
          createdAt: new Date().toISOString(),
        },
      ]);
      setDraft("");
      setReplyTo(null);
      setAttachment(null);
      toast("Internal note added");
      return;
    }
    // An attachment that is still uploading has no mediaUrl yet. Previously
    // this case silently fell through to the text path and delivered
    // "📎 filename.pdf" as a plain text message — the file never left the
    // browser. Block instead, and let the user retry once the upload lands.
    if (attachment && attachment.uploading) {
      toast("Attachment is still uploading…", "warning");
      return;
    }
    if (attachment && !attachment.mediaUrl) {
      toast("Attachment failed to upload — remove it and try again", "danger");
      return;
    }

    // Attachment finished uploading → send it as a real WhatsApp media
    // message. The caption/content is the typed text, never a filename
    // appended to it.
    const media =
      attachment?.mediaUrl && attachment?.mediaType
        ? {
            mediaUrl: attachment.mediaUrl,
            mediaType: attachment.mediaType,
            durationSec: attachment.durationSec,
            filename: attachment.name,
            fileSize: attachment.size,
          }
        : null;

    const extra: OutgoingExtras = {};
    if (replyTo) extra.replyToPreview = replyTo.content?.slice(0, 80);
    if (attachment) extra.attachmentName = attachment.name;
    if (attachment?.durationSec !== undefined)
      extra.durationSec = attachment.durationSec;
    if (media) {
      extra.messageType = media.mediaType;
      extra.mediaUrl = media.mediaUrl;
      extra.fileName = media.filename;
      extra.fileSize = media.fileSize;
    }

    // `content` is required server-side (it doubles as the conversation-list
    // snippet), so a caption-less media send still needs something sensible:
    // the voice-note label for audio, the filename for everything else.
    const finalText = media
      ? text || (media.mediaType === "audio" ? "🎤 Voice message" : attachment!.name)
      : text;

    setSending(true);
    const ok = await performSend(sel._id, finalText, extra, media);
    setSending(false);
    setDraft("");
    setReplyTo(null);
    setAttachment(null);
    if (!ok) toast("Message failed to send", "danger");
  }, [draft, sending, composerMode, replyTo, attachment, performSend, toast]);

  /* ── Message actions ──────────────────────────────────────────────── */
  const handleMsgAction = useCallback(
    (key: MessageActionKey, msg: ChatMessage) => {
      switch (key) {
        case "copy":
          navigator.clipboard?.writeText(msg.content);
          toast("Copied to clipboard");
          break;
        case "delete": {
          const sid = selectedRef.current?._id;
          if (!sid) break;

          // Optimistic remove — snapshot so we can roll back on failure.
          const snapshot = msgsRef.current;
          setMsgs((p) => p.filter((m) => m._id !== msg._id));

          conversationsApi
            .deleteMessage(sid, msg._id)
            .then(() => {
              toast("Deleted for me");
            })
            .catch((e) => {
              console.error(e);
              setMsgs(snapshot); // rollback — backend didn't confirm the delete
              toast("Failed to delete message", "danger");
            });
          break;
        }
        case "pin":
          setPinnedMsgIds((s) => {
            const n = new Set(s);
            const had = n.has(msg._id);

            if (had) {
              n.delete(msg._id);
            } else {
              n.add(msg._id);
            }

            toast(had ? "Unpinned" : "Pinned message");

            return n;
          });
          break;
        case "star":
          setStarredMsgIds((s) => {
            const n = new Set(s);
            const had = n.has(msg._id);

            if (had) {
              n.delete(msg._id);
            } else {
              n.add(msg._id);
            }

            toast(had ? "Unstarred" : "Starred message");

            return n;
          });
          break;
        case "reply":
          setReplyTo(msg);
          setComposerMode("reply");
          taRef.current?.focus();
          break;
        case "forward":
          setForwardTarget(msg);
          break;
        case "info":
          setInfoIds((s) => ({ ...s, [msg._id]: true }));
          break;
      }
    },
    [toast],
  );

  const handleForward = useCallback(
    async (targetConv: Conversation) => {
      const msg = forwardTarget;
      setForwardTarget(null);
      if (!msg) return;
      const ok = await performSend(targetConv._id, msg.content);
      toast(
        ok
          ? `Forwarded to ${targetConv.displayName || targetConv.phoneNumber}`
          : "Forward failed",
        ok ? "primary" : "danger",
      );
    },
    [forwardTarget, performSend, toast],
  );

  /* ── Conversation-level actions ───────────────────────────────────── */
  const handleHeaderAction = useCallback(
    (key: HeaderActionKey) => {
      const sel = selectedRef.current;
      if (!sel) return;
      const id = sel._id;

      const toggle = (
        setFn: React.Dispatch<React.SetStateAction<Set<string>>>,
        onMsg: string,
        offMsg: string,
      ) =>
        setFn((s) => {
          const n = new Set(s);
          const had = n.has(id);

          if (had) {
            n.delete(id);
          } else {
            n.add(id);
          }

          toast(had ? offMsg : onMsg);

          return n;
        });

      switch (key) {
        case "mute":
          toggle(setMutedConvIds, "Conversation muted", "Conversation unmuted");
          break;
        case "archive": {
          const willArchive = !archivedConvIds.has(id);
          toggle(
            setArchivedConvIds,
            "Conversation archived",
            "Conversation unarchived",
          );
          setConversationPrefs(id, { archived: willArchive });
          const archiveCall = willArchive
            ? conversationsApi.archive(id)
            : conversationsApi.unarchive(id);
          archiveCall.catch(() => {
            // Best-effort — a failed sync just means it reverts on next conv list refresh.
          });
          break;
        }
        case "pin":
          toggle(
            setPinnedConvIds,
            "Conversation pinned",
            "Conversation unpinned",
          );
          break;
        case "delete":
          setConvs((p) => p.filter((c) => c._id !== id));
          setSelected(null);
          toast("Conversation deleted");
          break;
        case "save-contact": {
          const currentProfile = profilesRef.current[id] ?? {};
          const name = currentProfile.name || sel.phoneNumber || "contact";
          downloadText(
            `${name.replace(/\s+/g, "_")}.vcf`,
            `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;TYPE=CELL:${sel.phoneNumber || ""}\nEND:VCARD`,
            "text/vcard",
          );
          toast("Contact saved as .vcf");
          break;
        }
        case "export": {
          const currentProfile = profilesRef.current[id] ?? {};
          const name = currentProfile.name || sel.phoneNumber || "chat";
          const lines = msgsRef.current
            .filter((m) => m.direction !== "note")
            .map(
              (m) =>
                `[${fmtTime(m.createdAt)}] ${m.direction === "outbound" ? "You" : name}: ${m.content}`,
            );
          downloadText(
            `${name.replace(/\s+/g, "_")}-chat.txt`,
            lines.join("\n") || "No messages yet",
          );
          toast("Chat exported");
          break;
        }
      }
    },
    [toast, archivedConvIds],
  );

  /* ── Per-conversation notification prefs (Task 3) ─────────────────── */
  const selectedNotifPrefs = useMemo<ConvNotifPrefs>(
    () =>
      (selected && convNotifPrefs[selected._id]) || DEFAULT_CONV_NOTIF_PREFS,
    [selected, convNotifPrefs],
  );

  const setConvNotifPref = useCallback((patch: Partial<ConvNotifPrefs>) => {
    const sid = selectedRef.current?._id;
    if (!sid) return;
    setConvNotifPrefs((p) => ({
      ...p,
      [sid]: { ...(p[sid] ?? DEFAULT_CONV_NOTIF_PREFS), ...patch },
    }));
  }, []);

  const handleToggleNotifications = useCallback(
    (v: boolean) => {
      setConvNotifPref({ notifications: v });
      const sid = selectedRef.current?._id;
      if (sid) {
        setConversationPrefs(sid, { muteNotifications: !v });
        conversationsApi
          .updatePreferences(sid, { muteNotifications: !v })
          .catch(() => {
            // Best-effort — a failed sync just means it reverts on next conv list refresh.
          });
      }
      toast(
        v
          ? "Notifications on for this chat"
          : "Notifications off for this chat",
      );
    },
    [setConvNotifPref, toast],
  );

  const handleToggleSound = useCallback(
    (v: boolean) => {
      setConvNotifPref({ sound: v });
      const sid = selectedRef.current?._id;
      if (sid) {
        setConversationPrefs(sid, { muteSound: !v });
        conversationsApi.updatePreferences(sid, { muteSound: !v }).catch(() => {
          // Best-effort.
        });
      }
      toast(v ? "Notification sound on" : "Notification sound off");
    },
    [setConvNotifPref, toast],
  );

  /* ── Voice notes (Task 6) — piggybacks on the existing attachment +
     send pipeline unchanged; only the UI entry point is new. ────────── */
  const handleVoiceRecorded = useCallback(
    async (note: RecordedVoiceNote) => {
      if (!note.blob) {
        toast("Recording failed — no audio captured", "danger");
        return;
      }
      toast("Uploading voice message…");
      try {
        const r = await conversationsApi.uploadVoiceNote(note.blob, note.name);
        const uploaded = r?.data ?? r;
        setAttachment({
          name: note.name,
          size: note.size,
          mediaUrl: uploaded.url,
          mediaType: "audio",
          durationSec: note.durationSec,
        });
        toast("Voice message ready to send");
      } catch (e) {
        console.error(e);
        toast("Voice message upload failed", "danger");
      }
    },
    [toast],
  );

  const handleVoiceError = useCallback(
    (message: string) => {
      toast(message, "danger");
    },
    [toast],
  );

  /* ── Internal notes save — persisted to Conversation.internalNotes ──── */
  /* ── Internal notes save — persisted to Conversation.internalNotes ──── */
  const handleSaveNotes = useCallback(
    async (notes: string) => {
      const sid = selectedRef.current?._id;
      if (!sid) return;

      setProfiles((p) => ({
        ...p,
        [sid]: { ...(p[sid] ?? { tags: [], customFields: [] }), notes },
      }));

      try {
        await conversationsApi.updateNotes(sid, notes);
        setConvs((prev) =>
          prev.map((c) => (c._id === sid ? { ...c, internalNotes: notes } : c)),
        );
        toast(notes ? "Notes saved" : "Notes cleared");
      } catch (e) {
        console.error(e);
        toast("Failed to save notes", "danger");
      }
    },
    [toast],
  );

  /* ── Tag save — writes directly to Contact.tags in MongoDB.
     Single-tag semantics: always replace the array with [tag] (or []
     to clear). Both the WhatsApp Panel and the Conversation List read
     from the same conv.contactId.tags, so this one write keeps everything
     in sync without a refetch. ───────────────────────────────────────── */
  const handleSaveTag = useCallback(
    async (tag: string) => {
      const sel = selectedRef.current;
      const contactId =
        typeof sel?.contactId === "object"
          ? (sel.contactId as any)?._id
          : sel?.contactId;

      if (!contactId) {
        toast("This conversation has no linked contact yet", "danger");
        return;
      }

      const trimmed = tag.trim();
      const nextTags = trimmed ? [trimmed] : [];

      try {
        await contactsApi.update(contactId, { tags: nextTags });

        // Small helper so we don't repeat the same patch logic twice below.
        const patchTags = (c: Conversation): Conversation => {
          const cid =
            typeof c.contactId === "object"
              ? (c.contactId as any)?._id
              : c.contactId;
          if (cid !== contactId) return c;
          return {
            ...c,
            contactId:
              typeof c.contactId === "object"
                ? { ...(c.contactId as any), tags: nextTags }
                : c.contactId,
          };
        };

        // Reflect immediately in the conversation list...
        setConvs((prev) => prev.map(patchTags));

        // ...AND in the currently open panel — RightPanel reads conv={selected},
        // which is separate state from convs, so without this the open panel
        // keeps showing the stale tag until the user re-clicks the conversation.
        setSelected((prev) => (prev ? patchTags(prev) : prev));

        toast(trimmed ? `Tag set to "${trimmed}"` : "Tag removed");
      } catch (e) {
        console.error(e);
        toast("Failed to update tag", "danger");
      }
    },
    [toast],
  );

  /* ── Link Contact modal — for conversations with no linked contact ──── */
  const [linkContactModalOpen, setLinkContactModalOpen] = useState(false);

  const openLinkContactModal = useCallback(
    () => setLinkContactModalOpen(true),
    [],
  );
  const closeLinkContactModal = useCallback(
    () => setLinkContactModalOpen(false),
    [],
  );

  const checkMatchingContact = useCallback(async () => {
    const sel = selectedRef.current;
    if (!sel) return null;
    try {
      const r = await conversationsApi.findMatchingContact(sel._id);
      const c = r?.data;
      if (!c) return null;
      return { _id: c._id, name: c.name, phone: c.phoneNumber };
    } catch (e) {
      console.error(e);
      return null;
    }
  }, []);

  const handleSaveProfileName = useCallback(
    async (name: string) => {
      const sid = selectedRef.current?._id;
      if (!sid || !name.trim()) return;
      try {
        const r = await conversationsApi.updateDisplayName(sid, name.trim());
        const updated = r?.data ?? r;
        if (updated?._id) {
          setConvs((prev) =>
            prev.map((c) => (c._id === updated._id ? { ...c, ...updated } : c)),
          );
          setSelected((prev) =>
            prev && prev._id === updated._id ? { ...prev, ...updated } : prev,
          );
        }
        toast("Name saved");
      } catch (e) {
        console.error(e);
        toast("Failed to save name", "danger");
      }
    },
    [toast],
  );

  const applyLinkedConversation = useCallback((updated: any) => {
    if (!updated?._id) return;
    setConvs((prev) =>
      prev.map((c) => (c._id === updated._id ? { ...c, ...updated } : c)),
    );
    setSelected((prev) =>
      prev && prev._id === updated._id ? { ...prev, ...updated } : prev,
    );
  }, []);

  const linkExistingContact = useCallback(
    async (contactId: string) => {
      const sel = selectedRef.current;
      if (!sel) return;
      try {
        const r = await conversationsApi.linkContact(sel._id, contactId);
        applyLinkedConversation(r?.data ?? r);
        toast("Contact linked");
      } catch (e: any) {
        console.error(e);
        const msg = e?.response?.data?.message || "Failed to link contact";
        toast(msg, "danger");
        throw e;
      }
    },
    [applyLinkedConversation, toast],
  );

  const createAndLinkNewContact = useCallback(
    async (data: { name: string; email?: string }) => {
      const sel = selectedRef.current;
      if (!sel) return;
      try {
        const r = await conversationsApi.createAndLinkContact(sel._id, data);
        applyLinkedConversation(r?.data ?? r);
        toast("Contact created and linked");
      } catch (e) {
        console.error(e);
        toast("Failed to create contact", "danger");
        throw e;
      }
    },
    [applyLinkedConversation, toast],
  );

  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Picking a file must actually UPLOAD it — capturing only name/size left the
   * attachment without a mediaUrl, which made send() fall through to the text
   * path and deliver the filename as a plain text message instead of the file.
   *
   * The chip is shown immediately (uploading: true) so the UI stays responsive,
   * then patched with the Cloudinary URL once the upload resolves.
   */
  const handleFileChosen = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Reset the input straight away so re-picking the same file still fires
      // onChange.
      e.target.value = "";
      if (!file) return;

      setAttachment({ name: file.name, size: file.size, uploading: true });

      try {
        const r = await conversationsApi.uploadAttachment(file);
        const uploaded = r?.data ?? r;
        if (!uploaded?.url) throw new Error("Upload returned no url");

        setAttachment({
          name: file.name,
          size: file.size,
          mediaUrl: uploaded.url,
          mediaType: mediaTypeForMime(file.type),
          uploading: false,
        });
        toast(`Attached ${file.name}`);
      } catch (err) {
        console.error(err);
        // Clear it — leaving a half-built attachment around is what allowed
        // the silent text fallback in the first place.
        setAttachment(null);
        toast(`Could not upload ${file.name}`, "danger");
      }
    },
    [toast],
  );

  /* ── Appearance-derived CSS vars (independent of design-token colors) ─ */
  const appearancePreset = APPEARANCE_PRESETS.find((p) => p.key === appearance);
  const appearanceVars: React.CSSProperties = appearancePreset?.bubbleOut
    ? ({
        "--c-bubble-out": appearancePreset.bubbleOut,
        "--c-bubble-out-text": appearancePreset.bubbleOutText,
        // Theme washes — cascade from the root down into the header, the
        // message wall, and the composer so the live UI matches the
        // preview card instead of only recoloring the outgoing bubble.
        "--c-theme-solid": appearancePreset.solid,
        "--c-theme-wash-strong": hexToRgba(appearancePreset.solid, 0.22),
        "--c-theme-wash-soft": hexToRgba(appearancePreset.solid, 0.11),
        "--c-theme-wash-faint": hexToRgba(appearancePreset.solid, 0.05),
      } as React.CSSProperties)
    : {};

  return {
    // core state
    convs,
    convsList,
    searchParams,
    setSearchParams,
    selected,
    setSelected,
    msgs,
    loading,
    draft,
    setDraft,
    sending,
    search,
    setSearch,
    filter,
    setFilter,
    showEmoji,
    setShowEmoji,
    showQuickReplies,
    setShowQuickReplies,
    atBottom,
    scrollDepth,
    loadingOlder,
    hasMoreOlder,
    composerMode,
    setComposerMode,
    cmdOpen,
    setCmdOpen,
    inThreadSearch,
    setInThreadSearch,
    threadQuery,
    setThreadQuery,
    replyTo,
    setReplyTo,
    attachment,
    setAttachment,
    forwardTarget,
    setForwardTarget,
    settingsOpen,
    setSettingsOpen,
    toasts,
    infoIds,
    setInfoIds,
    pinnedConvIds,
    mutedConvIds,
    archivedConvIds,
    pinnedMsgIds,
    setPinnedMsgIds,
    starredMsgIds,
    profiles,
    convNotifPrefs,
    appearance,
    setAppearance,
    savedReplies,
    addSavedReply,
    deleteSavedReply,
    sidebarCollapsed,
    setSidebarCollapsed,
    rightCollapsed,
    setRightCollapsed,
    focusMode,
    setFocusMode,
    typingUsers,
    onlineUsers,
    theme,
    isFullscreen,
    setIsFullscreen,

    // refs
    scrollRef,
    bottomRef,
    taRef,
    fileInputRef,
    msgRefs,

    // socket
    connected,

    // helpers / handlers
    toast,
    loadConvs,
    pick,
    profile,
    setProfile,
    groupedMsgs,
    visibleMsgCount,
    pinnedMsgObjs,
    isTyping,
    onScroll,
    goBottom,
    send,
    handleMsgAction,
    handleForward,
    handleHeaderAction,
    selectedNotifPrefs,
    handleToggleNotifications,
    handleToggleSound,
    handleVoiceRecorded,
    handleVoiceError,
    handleSaveNotes,
    handleSaveProfileName,
    handleSaveTag,
    handleAttachClick,
    handleFileChosen,
    linkContactModalOpen,
    openLinkContactModal,
    closeLinkContactModal,
    checkMatchingContact,
    linkExistingContact,
    createAndLinkNewContact,

    // appearance
    appearanceVars,
  };
}

export type ConversationPageLogic = ReturnType<typeof useConversationPageLogic>;