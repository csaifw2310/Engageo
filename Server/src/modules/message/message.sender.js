import ApiError from '../../utils/ApiError.js';
import {
  GRAPH_API_BASE_URL,
  GRAPH_API_TIMEOUT_MS,
} from '../whatsapp/whatsapp.constants.js';
import { MESSAGE_MESSAGES } from './message.constants.js';

/**
 * Real WhatsApp Cloud API sender.
 *
 * Sends a single template message via:
 *   POST {GRAPH_API_BASE_URL}/{phoneNumberId}/messages
 *
 * It is intentionally dumb: it knows how to talk to Meta and nothing about
 * Mongo, campaigns or retries. The service decides *whether* and *when* to call
 * it; this only performs one HTTP round-trip and normalises the result.
 *
 * Contract (shared with mock.sender.js so they are interchangeable):
 *   sendTemplateMessage({ phoneNumberId, accessToken, to, templateName, languageCode })
 *     → { waMessageId, raw }            on success
 *     → throws ApiError(502 | 401, msg) on failure
 *
 * The fetch/timeout/error shape mirrors the WhatsApp module's verification call
 * so the whole app fails the same way against the Graph API.
 */
export const sendTemplateMessage = async ({
  phoneNumberId,
  accessToken,
  to,
  templateName,
  languageCode,
}) => {
  const url = `${GRAPH_API_BASE_URL}/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GRAPH_API_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    // Network / timeout / abort — transport-level failure.
    throw new ApiError(502, `${MESSAGE_MESSAGES.SEND_FAILED}: ${err.message}`, [
      { provider: 'meta', reason: err.name === 'AbortError' ? 'timeout' : err.message },
    ]);
  } finally {
    clearTimeout(timeout);
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const metaMessage = body?.error?.message || `HTTP ${response.status}`;
    // Auth/permission problems are surfaced as 401 (token issue); everything
    // else from Meta is an upstream 502.
    const statusCode =
      response.status === 401 || response.status === 403 ? 401 : 502;
    throw new ApiError(statusCode, `${MESSAGE_MESSAGES.SEND_FAILED}: ${metaMessage}`, [
      { provider: 'meta', httpStatus: response.status, response: body },
    ]);
  }

  // Successful Cloud API response shape: { messages: [{ id: "wamid..." }] }
  const waMessageId = body?.messages?.[0]?.id || null;
  if (!waMessageId) {
    throw new ApiError(502, `${MESSAGE_MESSAGES.SEND_FAILED}: missing message id`, [
      { provider: 'meta', response: body },
    ]);
  }

  return { waMessageId, raw: body };
};

export const sendTextMessage = async ({
  phoneNumberId,
  accessToken,
  to,
  content,
}) => {
  const url = `${GRAPH_API_BASE_URL}/${phoneNumberId}/messages`;
  const recipient = String(to).replace(/^\+/, '');

  const payload = {
    messaging_product: 'whatsapp',
    to: recipient,
    type: 'text',
    text: { body: content },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GRAPH_API_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    throw new ApiError(502, `${MESSAGE_MESSAGES.SEND_FAILED}: ${err.message}`, [
      { provider: 'meta', reason: err.name === 'AbortError' ? 'timeout' : err.message },
    ]);
  } finally {
    clearTimeout(timeout);
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const metaMessage = body?.error?.message || `HTTP ${response.status}`;
    const statusCode =
      response.status === 401 || response.status === 403 ? 401 : 502;
    throw new ApiError(statusCode, `${MESSAGE_MESSAGES.SEND_FAILED}: ${metaMessage}`, [
      { provider: 'meta', httpStatus: response.status, response: body },
    ]);
  }

  const waMessageId = body?.messages?.[0]?.id || null;
  if (!waMessageId) {
    throw new ApiError(502, `${MESSAGE_MESSAGES.SEND_FAILED}: missing message id`, [
      { provider: 'meta', response: body },
    ]);
  }

  return { waMessageId, raw: body };
};

/**
 * Sends a single media message (audio/image/video/document) via:
 *   POST {GRAPH_API_BASE_URL}/{phoneNumberId}/messages
 *
 * WhatsApp Cloud API accepts a hosted URL directly via the `link` field —
 * no separate "upload to Meta" round-trip needed since the file is already
 * hosted on Cloudinary. `mediaType` must be one of the four WhatsApp
 * message types: 'image' | 'audio' | 'video' | 'document'.
 *
 * `caption` is ignored for 'audio' — WhatsApp's audio message object has no
 * caption field (unlike image/video/document), so it's silently dropped
 * rather than sent and rejected by Meta.
 *
 * Same contract shape as sendTextMessage/sendTemplateMessage:
 *   → { waMessageId, raw }            on success
 *   → throws ApiError(502 | 401, msg) on failure
 */
export const sendMediaMessage = async ({
  phoneNumberId,
  accessToken,
  to,
  mediaUrl,
  mediaType,
  caption,
  filename = null,
}) => {
  const url = `${GRAPH_API_BASE_URL}/${phoneNumberId}/messages`;
  const recipient = String(to).replace(/^\+/, '');

  // Per-type object shapes:
  //   audio    → link only (the Cloud API rejects a caption on audio)
  //   document → link + filename (the name shown on the recipient's document
  //              card; omitting it surfaces the Cloudinary public_id instead)
  //              + optional caption
  //   image/video → link + optional caption
  const mediaObject =
    mediaType === 'audio'
      ? { link: mediaUrl }
      : mediaType === 'document'
        ? {
            link: mediaUrl,
            ...(filename ? { filename } : {}),
            ...(caption ? { caption } : {}),
          }
        : { link: mediaUrl, ...(caption ? { caption } : {}) };

  const payload = {
    messaging_product: 'whatsapp',
    to: recipient,
    type: mediaType,
    [mediaType]: mediaObject,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GRAPH_API_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    throw new ApiError(502, `${MESSAGE_MESSAGES.SEND_FAILED}: ${err.message}`, [
      { provider: 'meta', reason: err.name === 'AbortError' ? 'timeout' : err.message },
    ]);
  } finally {
    clearTimeout(timeout);
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const metaMessage = body?.error?.message || `HTTP ${response.status}`;
    const statusCode =
      response.status === 401 || response.status === 403 ? 401 : 502;
    throw new ApiError(statusCode, `${MESSAGE_MESSAGES.SEND_FAILED}: ${metaMessage}`, [
      { provider: 'meta', httpStatus: response.status, response: body },
    ]);
  }

  const waMessageId = body?.messages?.[0]?.id || null;
  if (!waMessageId) {
    throw new ApiError(502, `${MESSAGE_MESSAGES.SEND_FAILED}: missing message id`, [
      { provider: 'meta', response: body },
    ]);
  }

  return { waMessageId, raw: body };
};

export default { sendTemplateMessage, sendTextMessage, sendMediaMessage };