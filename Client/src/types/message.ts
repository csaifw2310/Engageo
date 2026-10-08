/* ───────────────────────────────────────────────────────────────────────────
   Message domain types
─────────────────────────────────────────────────────────────────────────── */

export type MessageDirection = "inbound" | "outbound" | "note";

/**
 * Backend persists an uppercase enum (PENDING/SENT/DELIVERED/READ/FAILED).
 * Optimistic temps use lowercase (sending/sent/failed).
 * StatusDot normalises both, so the type accepts either casing.
 */
export type MessageStatus =
  | "sending"
  | "pending"
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "replied"
  | "failed"
  | "PENDING"
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED"
  | (string & Record<never, never>); // allow arbitrary strings without widening to string

export interface ChatMessage {
  _id: string;
  conversationId?: string;
  direction: MessageDirection;
  content: string;
  status?: MessageStatus;
  createdAt: string;
  replyToPreview?: string;
  attachmentName?: string;
  messageType?: string;
  mediaUrl?: string | null;
  /** Original filename for document messages, persisted server-side. */
  fileName?: string | null;
  /** Size in bytes, shown on the document card. */
  fileSize?: number | null;
  durationSec?: number;
}

/** Extra fields merged onto an optimistic message before the API confirms it. */
export interface OutgoingExtras {
  replyToPreview?: string;
  attachmentName?: string;
  durationSec?: number;
  messageType?: string;
  mediaUrl?: string;
  /** Mirrors ChatMessage.fileName so an optimistic bubble renders the
   *  document card with the right name before the server echo arrives. */
  fileName?: string;
  fileSize?: number;
}

export interface Attachment {
  name: string;
  size: number;
  /** Cloudinary URL — set once the file/voice-note has finished uploading. */
  mediaUrl?: string;
  /** WhatsApp message type for this attachment: 'audio' | 'image' | 'video' | 'document' */
  mediaType?: string;
  durationSec?: number;
  /**
   * True while the file is still being uploaded to Cloudinary. The send path
   * refuses to send in this state — previously a not-yet-uploaded attachment
   * silently fell back to sending the filename as a plain text message.
   */
  uploading?: boolean;
}