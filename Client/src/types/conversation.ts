/* ───────────────────────────────────────────────────────────────────────────
   Conversation / inbox domain types
─────────────────────────────────────────────────────────────────────────── */
import type { ChatMessage } from "./message";

export type ConversationFilter =
  | "all"
  | "unread"
  | "pinned"
  | "campaign"
  | "archived";

export interface ConversationActivity {
  label: string;
  at?: string;
}

/**
 * The contact linked to a conversation.
 * Backend populates this via `.populate("contactId", "name phoneNumber email tags")`,
 * so at runtime it's an object — but keep `string` in the union to safely cover:
 *   - conversations where contactId hasn't been populated (raw ObjectId string)
 *   - conversations with no linked contact (undefined)
 */
export interface PopulatedContact {
  _id: string;
  name?: string;
  phoneNumber?: string;
  email?: string;
  /** Single-tag system: array from the DB schema, but only tags[0] is ever used/displayed. */
  tags?: string[];
}

export type ContactRef = string | PopulatedContact;

export interface Conversation {
  _id: string;
  contactId?: ContactRef;
  displayName?: string;
  phoneNumber?: string;
  internalNotes?: string | null;
  online?: boolean;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  draft?: string;
  campaignTag?: string;
  labels?: string[];
  archived?: boolean;
  totalMessages?: number;
  firstMessageAt?: string;
  lastTemplate?: string;
  campaigns?: ConversationCampaign[];
  activity?: ConversationActivity[];
}

export interface ConversationCampaign {
  id?: string;
  name?: string;
  status?: string;
  at?: string;
  sentAt?: string;
}

export interface CustomField {
  key: string;
  value: string;
}

export interface ProfileStats {
  totalMessages?: number;
  firstConversationAt?: string;
  lastActivityAt?: string;
  lastTemplate?: string;
}

/** Per-conversation editable profile kept in client state. */
export interface ConversationProfile {
  name?: string;
  tags?: string[];
  notes?: string;
  customFields?: CustomField[];
  stats?: ProfileStats;
  campaigns?: ConversationCampaign[];
  activity?: ConversationActivity[];
}

export type ProfileMap = Record<string, ConversationProfile>;

export interface SavedReply {
  id: string;
  title: string;
  body: string;
}

export type ToastTone = "primary" | "danger" | "success" | "warning";

export interface Toast {
  id: number;
  msg: string;
  tone: ToastTone;
}

export interface InboxSettings {
  desktopNotifications: boolean;
  readReceipts: boolean;
  soundAlerts: boolean;
}

/** A day-grouped bucket of messages for the thread view. */
export interface MessageDayGroup {
  label: string;
  msgs: ChatMessage[];
}

export type HeaderActionKey =
  | "mute"
  | "archive"
  | "pin"
  | "delete"
  | "save-contact"
  | "export"
  | "settings";

export type MessageActionKey =
  | "copy"
  | "delete"
  | "pin"
  | "star"
  | "reply"
  | "forward"
  | "summarize"
  | "info";