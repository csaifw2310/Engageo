import asyncHandler from '../../utils/asyncHandler.js';
import webhookService from './webhook.service.js';
import { WEBHOOK_MESSAGES } from './webhook.constants.js';

/**
 * GET /api/webhooks/whatsapp
 *
 * Meta subscription handshake. On success the RAW hub.challenge must be echoed
 * back as plain text (not JSON, not wrapped) with 200, or Meta rejects the
 * subscription. On failure we return the standard JSON error envelope with 403.
 */
const verifyWebhook = asyncHandler(async (req, res) => {
  const challenge = webhookService.verifyWebhook({
    mode: req.query['hub.mode'],
    token: req.query['hub.verify_token'],
    challenge: req.query['hub.challenge'],
  });

  if (challenge) {
    return res.status(200).send(challenge);
  }

  return res.status(403).json({
    success: false,
    message: WEBHOOK_MESSAGES.VERIFICATION_FAILED,
  });
});

/**
 * POST /api/webhooks/whatsapp
 *
 * Receives delivery/read/failure callbacks from Meta. Meta requires a fast 200
 * and treats anything else as a failure to retry, so this endpoint ALWAYS
 * responds 200 { success: true } regardless of payload shape or processing
 * outcome. processWebhook is fully defensive and never throws, so the response
 * is guaranteed.
 */
const receiveWebhook = asyncHandler(async (req, res) => {
  await webhookService.processWebhook(req.body);
  console.log("WEBHOOK HIT");
    console.log(JSON.stringify(req.body, null, 2));
  return res.status(200).json({ success: true });
});

export { verifyWebhook, receiveWebhook };
