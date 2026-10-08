import { randomBytes } from 'node:crypto';

/**
 * Mock WhatsApp sender.
 *
 * A drop-in replacement for message.sender.js that performs NO network I/O. It
 * is selected by the service whenever MESSAGE_MOCK_MODE=true, letting the entire
 * messaging engine — processCampaign, sendMessage, sendCampaign, retries,
 * pagination, multi-tenancy — be exercised end-to-end before a real WABA or an
 * approved template exists.
 *
 * It deliberately exposes the SAME contract as the real sender so callers never
 * branch on which one they hold:
 *   sendTemplateMessage({ phoneNumberId, accessToken, to, templateName, languageCode })
 *     → { waMessageId, raw }
 *
 * Generates a synthetic, unique id of the form `mock_msg_<hex>` so downstream
 * code (and the future Webhook module) can be tested against realistic-looking
 * ids without ever calling Meta.
 */
export const sendTemplateMessage = async ({
  to,
  templateName,
  languageCode,
}) => {
  const waMessageId = `mock_msg_${randomBytes(8).toString('hex')}`;

  // Echo back a payload shaped like the real Cloud API success body so it can be
  // stored verbatim in Message.metaResponse.
  const raw = {
    mock: true,
    messaging_product: 'whatsapp',
    contacts: [{ input: to, wa_id: String(to).replace(/\D/g, '') }],
    messages: [{ id: waMessageId }],
    template: { name: templateName, language: { code: languageCode } },
  };

  return { waMessageId, raw };
};


export const sendTextMessage = async ({ to, content }) => {
  const waMessageId = `mock_msg_${randomBytes(8).toString('hex')}`;

  const raw = {
    mock: true,
    messaging_product: 'whatsapp',
    contacts: [{ input: to, wa_id: String(to).replace(/\D/g, '') }],
    messages: [{ id: waMessageId }],
    text: { body: content },
  };

  return { waMessageId, raw };
};

export const sendMediaMessage = async ({
  to,
  mediaUrl,
  mediaType,
  caption,
  filename = null,
}) => {
  const waMessageId = `mock_msg_${randomBytes(8).toString('hex')}`;

  const raw = {
    mock: true,
    messaging_product: 'whatsapp',
    contacts: [{ input: to, wa_id: String(to).replace(/\D/g, '') }],
    messages: [{ id: waMessageId }],
    [mediaType]: {
      link: mediaUrl,
      ...(mediaType === 'document' && filename ? { filename } : {}),
      ...(mediaType !== 'audio' && caption ? { caption } : {}),
    },
  };

  return { waMessageId, raw };
};

export default { sendTemplateMessage, sendTextMessage, sendMediaMessage };