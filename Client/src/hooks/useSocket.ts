/* ───────────────────────────────────────────────────────────────────────────
   useSocket — stable socket connection with always-current handler callbacks.
─────────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { getAccessToken } from "../api/client";
import type {
  ConversationUpdatedPayload,
  NewMessagePayload,
  OnlineStatusPayload,
  ReadReceiptPayload,
  SocketHandlers,
  TypingPayload,
  UnreadUpdatePayload,
  UseSocketResult,
} from "../types/socket";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "http://localhost:4002";

export function useSocket({
  selectedId,
  onNewMessage,
  onTyping,
  onOnlineStatus,
  onReadReceipt,
  onUnreadUpdate,
  onConversationUpdated,
}: SocketHandlers): UseSocketResult {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  // ── Handler refs — updated every render so listeners never go stale ──────
  const onNewMessageRef = useRef(onNewMessage);
  const onTypingRef = useRef(onTyping);
  const onOnlineStatusRef = useRef(onOnlineStatus);
  const onReadReceiptRef = useRef(onReadReceipt);
  const onUnreadUpdateRef = useRef(onUnreadUpdate);
  const onConversationUpdatedRef = useRef(onConversationUpdated);

  // Keep refs current on every render
  onNewMessageRef.current = onNewMessage;
  onTypingRef.current = onTyping;
  onOnlineStatusRef.current = onOnlineStatus;
  onReadReceiptRef.current = onReadReceipt;
  onUnreadUpdateRef.current = onUnreadUpdate;
  onConversationUpdatedRef.current = onConversationUpdated;

  // ── Create socket once ────────────────────────────────────────────────────
  useEffect(() => {
    let socket: Socket | null = null;
    let destroyed = false;

    async function connect() {
      try {
        const { io } = await import("socket.io-client");

        socket = io(SOCKET_URL, {
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 10,
          timeout: 8000,
          withCredentials: true,
          auth: {
            token: getAccessToken(),
          },
        });

        if (destroyed) {
          socket.disconnect();
          return;
        }

        socketRef.current = socket;

        socket.on("connect", () => setConnected(true));
        socket.on("disconnect", () => setConnected(false));
        socket.on("connect_error", () => setConnected(false));

        socket.on("new_message", (data: NewMessagePayload) =>
          onNewMessageRef.current?.(data),
        );

        socket.on("typing", (data: TypingPayload) =>
          onTypingRef.current?.(data),
        );

        socket.on("stop_typing", (data: TypingPayload) =>
          onTypingRef.current?.({
            ...data,
            isTyping: false,
          }),
        );

        socket.on("online_status", (data: OnlineStatusPayload) =>
          onOnlineStatusRef.current?.(data),
        );

        socket.on("message_delivered", (data: ReadReceiptPayload) =>
          onReadReceiptRef.current?.({
            ...data,
            status: "delivered",
          }),
        );

        socket.on("read_receipt", (data: ReadReceiptPayload) =>
          onReadReceiptRef.current?.({
            ...data,
            status: "read",
          }),
        );

        socket.on("unread_update", (data: UnreadUpdatePayload) =>
          onUnreadUpdateRef.current?.(data),
        );

        socket.on("conversation_updated", (data: ConversationUpdatedPayload) =>
          onConversationUpdatedRef.current?.(data),
        );
      } catch {
        setConnected(false);
      }
    }

    connect();

    return () => {
      destroyed = true;
      socket?.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, []);

  // ── Conversation room management ──────────────────────────────────────────
  const joinedRoomRef = useRef<string | null>(null);

  useEffect(() => {
    const s = socketRef.current;

    if (joinedRoomRef.current && s) {
      s.emit("leave_conversation", {
        conversationId: joinedRoomRef.current,
      });
      joinedRoomRef.current = null;
    }

    if (!s || !selectedId) return;

    s.emit("join_conversation", {
      conversationId: selectedId,
    });

    joinedRoomRef.current = selectedId;

    return () => {
      if (socketRef.current && joinedRoomRef.current) {
        socketRef.current.emit("leave_conversation", {
          conversationId: joinedRoomRef.current,
        });

        joinedRoomRef.current = null;
      }
    };
  }, [selectedId]);

  // ── Stable emit helpers ───────────────────────────────────────────────────
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const emitTyping = useCallback((isTyping: boolean) => {
    const socket = socketRef.current;
    const conversationId = selectedIdRef.current;

    if (!socket || !conversationId) return;

    socket.emit("typing", {
      conversationId,
      isTyping,
    });
  }, []);

  const emitRead = useCallback((messageId: string) => {
    const socket = socketRef.current;
    const conversationId = selectedIdRef.current;

    if (!socket || !conversationId) return;

    socket.emit("mark_read", {
      conversationId,
      messageId,
    });
  }, []);

  return {
    connected,
    emitTyping,
    emitRead,
  };
}

export default useSocket;
