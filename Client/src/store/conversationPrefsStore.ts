// Lightweight shared store — NOT React state. Plain module-level Map so
// AppProvider can read the latest per-conversation preferences at the
// moment a socket notification arrives, without subscribing to re-renders.
// ConversationLogic is the writer (mirrors its local toggle state here);
// AppProvider is the only reader.

export interface ConversationPrefs {
  archived: boolean;
  muteNotifications: boolean;
  muteSound: boolean;
}

const DEFAULT_PREFS: ConversationPrefs = {
  archived: false,
  muteNotifications: false,
  muteSound: false,
};

const prefsMap = new Map<string, ConversationPrefs>();

export function setConversationPrefs(
  conversationId: string,
  patch: Partial<ConversationPrefs>,
): void {
  const existing = prefsMap.get(conversationId) ?? DEFAULT_PREFS;
  prefsMap.set(conversationId, { ...existing, ...patch });
}

export function getConversationPrefs(
  conversationId: string,
): ConversationPrefs {
  return prefsMap.get(conversationId) ?? DEFAULT_PREFS;
}

export function removeConversationPrefs(conversationId: string): void {
  prefsMap.delete(conversationId);
}

// Optional — call on logout so stale prefs don't leak into the next session.
export function resetConversationPrefsStore(): void {
  prefsMap.clear();
}