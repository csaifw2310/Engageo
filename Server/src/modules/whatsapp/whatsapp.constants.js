export const CONNECTION_STATUS = Object.freeze({
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
});

export const CONNECTION_STATUS_VALUES = Object.values(CONNECTION_STATUS);

export const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v21.0';
export const GRAPH_API_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
export const GRAPH_API_TIMEOUT_MS = 10_000;

export const WHATSAPP_MESSAGES = Object.freeze({
  CONNECTED: 'WhatsApp account connected successfully',
  STATUS_FETCHED: 'WhatsApp connection status fetched successfully',
  CONNECTION_FETCHED: 'WhatsApp connection fetched successfully',
  DISCONNECTED: 'WhatsApp account disconnected successfully',
  SYNCED: 'WhatsApp connection verified successfully',
  NOT_FOUND: 'No WhatsApp connection found for this account',
  NOT_CONNECTED: 'WhatsApp account is not currently connected',
  VERIFY_FAILED: 'Failed to verify WhatsApp connection with Meta',
  // OAuth exchange
  EXCHANGE_SUCCESS: 'WhatsApp account connected via Meta successfully',
  EXCHANGE_FAILED: 'Failed to exchange Meta authorisation code',
  WABA_FETCH_FAILED: 'Failed to fetch WhatsApp Business Account details from Meta',
  NO_PHONE_NUMBER: 'No WhatsApp phone number found on this Business Account',
});