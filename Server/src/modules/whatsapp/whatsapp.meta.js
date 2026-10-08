import config from '../../config/config.js';
import ApiError from '../../utils/ApiError.js';
import {
  GRAPH_API_BASE_URL,
  GRAPH_API_TIMEOUT_MS,
  WHATSAPP_MESSAGES,
} from './whatsapp.constants.js';

async function graphRequest(url, { method = 'GET', headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GRAPH_API_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, { method, headers, signal: controller.signal });
  } catch (err) {
    throw new ApiError(502, `Meta Graph API unreachable: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg = payload?.error?.message || `HTTP ${response.status}`;
    console.log('[meta] full error payload:', JSON.stringify(payload, null, 2));
    const status = [401, 403].includes(response.status) ? 401 : 502;
    throw new ApiError(status, msg);
  }

  return payload;
}

export async function exchangeCodeForToken(code) {
  const appId = config.META_APP_ID;
  const appSecret = config.META_APP_SECRET;
  const redirectUri = config.META_REDIRECT_URI;

  // ── DEBUG LOGS ─────────────────────────────────────────────────────────────
  console.log('[meta] APP_ID:', appId);
  console.log('[meta] REDIRECT_URI:', JSON.stringify(redirectUri));
  console.log('[meta] CODE (first 20):', code?.slice(0, 20));
  // ───────────────────────────────────────────────────────────────────────────

// REDIRECT_URI ke end mein slash add karo
const url =
  `${GRAPH_API_BASE_URL}/oauth/access_token` +
  `?client_id=${appId}` +
  `&client_secret=${appSecret}` +
  `&redirect_uri=` +          // ← EMPTY, koi value nahi
  `&code=${encodeURIComponent(code)}`;

  console.log('[meta] TOKEN EXCHANGE URL:', url);

  const payload = await graphRequest(url);

  if (!payload.access_token) {
    throw new ApiError(502, 'Failed to exchange authorization code');
  }

  return payload.access_token;
}

export async function fetchWABADetails(accessToken) {
  const authHeader = { Authorization: `Bearer ${accessToken}` };

  const meUrl = `${GRAPH_API_BASE_URL}/me?fields=whatsapp_business_accounts`;
  const mePayload = await graphRequest(meUrl, { headers: authHeader }).catch((err) => {
    throw new ApiError(err.statusCode || 502, `${WHATSAPP_MESSAGES.WABA_FETCH_FAILED}: ${err.message}`);
  });

  const waba = mePayload?.whatsapp_business_accounts?.data?.[0];
  if (!waba?.id) {
    throw new ApiError(422, `${WHATSAPP_MESSAGES.WABA_FETCH_FAILED}: no WABA linked to this token`);
  }

  const businessAccountId = waba.id;

  const phonesUrl =
    `${GRAPH_API_BASE_URL}/${businessAccountId}/phone_numbers` +
    `?fields=id,display_phone_number,verified_name`;

  const phonesPayload = await graphRequest(phonesUrl, { headers: authHeader }).catch((err) => {
    throw new ApiError(err.statusCode || 502, `${WHATSAPP_MESSAGES.WABA_FETCH_FAILED}: ${err.message}`);
  });

  const phone = phonesPayload?.data?.[0];
  if (!phone?.id) {
    throw new ApiError(422, WHATSAPP_MESSAGES.NO_PHONE_NUMBER);
  }

  return {
    businessAccountId,
    phoneNumberId: phone.id,
    phoneNumber: phone.display_phone_number,
    businessName: phone.verified_name,
  };
}