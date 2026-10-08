export const SOCKET_EVENTS = Object.freeze({
  CONNECTION: "connection",
  DISCONNECT: "disconnect",

  JOIN_CONVERSATION: "join_conversation",
  LEAVE_CONVERSATION: "leave_conversation",

  TYPING: "typing",
  STOP_TYPING: "stop_typing",

  MARK_READ: "mark_read",

  NEW_MESSAGE: "new_message",
  MESSAGE_DELIVERED: "message_delivered",
  READ_RECEIPT: "read_receipt",

  CONVERSATION_UPDATED: "conversation_updated",

  CAMPAIGN_COMPLETED: "campaign_completed",

  NOTIFICATION: "notification",

  ERROR: "error",
});

export const SOCKET_ROOMS = Object.freeze({
  USER: "user",
  CONVERSATION: "conversation",
});

export const SOCKET_ERRORS = Object.freeze({
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_CONVERSATION: "INVALID_CONVERSATION",
});

// Mirrors the HTTP CORS allow-list in app.js: CLIENT_URL is the source of
// truth, with the Vite dev origins added only outside production. Hardcoding
// localhost here meant sockets silently failed to connect once deployed —
// the REST API would work and the inbox would just never update live.
export const SOCKET_CORS = Object.freeze({
  ORIGINS: [
    process.env.CLIENT_URL,
    ...(process.env.NODE_ENV === "production"
      ? []
      : ["http://localhost:5173", "https://localhost:5173"]),
  ].filter(Boolean),
});