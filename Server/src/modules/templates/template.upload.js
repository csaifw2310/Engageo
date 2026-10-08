import ApiError from '../../utils/ApiError.js';
import {
  GRAPH_API_BASE_URL,
  GRAPH_API_TIMEOUT_MS,
} from '../whatsapp/whatsapp.constants.js';
import config from '../../config/config.js';
import { TEMPLATE_MESSAGES } from './template.constants.js';


function throwGraphError(step, response, payload) {
  const err = payload?.error ?? {};
  const detail = {
    provider: 'meta',
    step,
    httpStatus: response.status,
    code: err.code ?? null,
    subcode: err.error_subcode ?? null,
    type: err.type ?? null,
    fbtrace_id: err.fbtrace_id ?? null,
    message: err.message ?? null,
  };

  // Always log the full body server-side; the client only gets a summary.
  console.error('[template.upload] Graph API error', {
    ...detail,
    body: payload,
  });

  const parts = [err.message || `HTTP ${response.status}`];
  if (err.code != null) parts.push(`code ${err.code}`);
  if (err.error_subcode != null) parts.push(`subcode ${err.error_subcode}`);
  if (err.fbtrace_id) parts.push(`trace ${err.fbtrace_id}`);

  const status =
    response.status === 401 || response.status === 403 ? 401 : 502;

  throw new ApiError(
    status,
    `${TEMPLATE_MESSAGES.MEDIA_UPLOAD_FAILED}: ${parts.join(' · ')}`,
    [detail],
  );
}

async function withTimeout(run) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GRAPH_API_TIMEOUT_MS);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Uploads a single file to Meta and returns its media handle.
 *
 * @param {Object} params
 * @param {Buffer} params.buffer - Raw file bytes (from multer memoryStorage).
 * @param {string} params.mimeType - The file's MIME type (e.g. 'image/png').
 * @returns {Promise<{ handle: string }>}
 */
async function uploadHeaderMediaToMeta({ buffer, mimeType }) {
  const appId = config.META_APP_ID;
  if (!appId) {
    throw new ApiError(
      500,
      `${TEMPLATE_MESSAGES.MEDIA_UPLOAD_FAILED}: META_APP_ID is not configured`,
    );
  }

  const uploadToken = config.META_SYSTEM_USER_TOKEN;
  if (!uploadToken) {
    throw new ApiError(
      500,
      `${TEMPLATE_MESSAGES.MEDIA_UPLOAD_FAILED}: META_SYSTEM_USER_TOKEN is not configured. ` +
        `Generate a System User token in the Business Manager that owns the Meta app, ` +
        `give it access to the app and the whatsapp_business_management scope, ` +
        `then set it in .env.`,
    );
  }

  // ── Step 1: start an upload session ──────────────────────────────────────
  const sessionUrl =
    `${GRAPH_API_BASE_URL}/${appId}/uploads` +
    `?file_length=${buffer.length}` +
    `&file_type=${encodeURIComponent(mimeType)}`;

  const sessionPayload = await withTimeout(async (signal) => {
    let response;
    try {
      response = await fetch(sessionUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${uploadToken}` },
        signal,
      });
    } catch (err) {
      throw new ApiError(502, `${TEMPLATE_MESSAGES.MEDIA_UPLOAD_FAILED}: ${err.message}`);
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throwGraphError('create-session', response, payload);
    return payload;
  });

  const uploadSessionId = sessionPayload?.id;
  if (!uploadSessionId) {
    throw new ApiError(502, `${TEMPLATE_MESSAGES.MEDIA_UPLOAD_FAILED}: no upload session id returned`);
  }

  // ── Step 2: push the file bytes to the session ───────────────────────────
  const uploadUrl = `${GRAPH_API_BASE_URL}/${uploadSessionId}`;

  const uploadPayload = await withTimeout(async (signal) => {
    let response;
    try {
      response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `OAuth ${uploadToken}`,
          file_offset: '0',
        },
        body: buffer,
        signal,
      });
    } catch (err) {
      throw new ApiError(502, `${TEMPLATE_MESSAGES.MEDIA_UPLOAD_FAILED}: ${err.message}`);
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throwGraphError('upload-bytes', response, payload);
    return payload;
  });

  const handle = uploadPayload?.h;
  if (!handle) {
    throw new ApiError(502, `${TEMPLATE_MESSAGES.MEDIA_UPLOAD_FAILED}: no media handle returned`);
  }

  return { handle };
}

export { uploadHeaderMediaToMeta };