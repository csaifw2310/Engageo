/* ───────────────────────────────────────────────────────────────────────────
   Socket.IO realtime payload types
─────────────────────────────────────────────────────────────────────────── */
import type { ChatMessage } from "./message";
import type { Conversation } from "./conversation";

export interface NewMessagePayload {
  conversationId: string;
  message: ChatMessage;
}

export interface TypingPayload {
  conversationId: string;
  isTyping: boolean;
  userName?: string;
}

export interface OnlineStatusPayload {
  conversationId: string;
  online: boolean;
}

export interface ReadReceiptPayload {
  conversationId?: string;
  messageId: string;
  /** Backend sends uppercase (DELIVERED, READ) or lowercase — StatusDot normalises both. */
  status?: string;
}

export interface UnreadUpdatePayload {
  conversationId: string;
  unreadCount?: number;
  lastMessage?: string;
  lastMessageAt?: string;
  [key: string]: unknown;
}

/** Full conversation shape sent by conversation_updated event. */
export type ConversationUpdatedPayload = Conversation;

export interface SocketHandlers {
  selectedId?: string;
  onNewMessage?: (data: NewMessagePayload) => void;
  onTyping?: (data: TypingPayload) => void;
  onOnlineStatus?: (data: OnlineStatusPayload) => void;
  onReadReceipt?: (data: ReadReceiptPayload) => void;
  onUnreadUpdate?: (data: UnreadUpdatePayload) => void;
  onConversationUpdated?: (data: ConversationUpdatedPayload) => void;
}

export interface UseSocketResult {
  connected: boolean;
  emitTyping: (isTyping: boolean) => void;
  emitRead: (messageId: string) => void;
}