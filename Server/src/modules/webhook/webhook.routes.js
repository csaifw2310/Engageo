import express from 'express';

import * as controller from './webhook.controller.js';

const webhookRouter = express.Router();

/**
 * Webhook routes are called by Meta's servers, NOT by an authenticated tenant,
 * so the `protect` middleware is deliberately NOT applied here. Tenant scoping
 * is recovered downstream from the matched Message document (see the service).
 *
 *   GET  /api/webhooks/whatsapp  → subscription verification handshake
 *   POST /api/webhooks/whatsapp  → delivery / read / failure status callbacks
 */
webhookRouter.get('/', controller.verifyWebhook);
webhookRouter.post('/', controller.receiveWebhook);

export default webhookRouter;
