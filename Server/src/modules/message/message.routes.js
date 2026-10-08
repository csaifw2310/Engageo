import express from 'express';

import { protect } from '../../shared/middlewares/auth.middleware.js';
import validate from '../../shared/middlewares/validate.middleware.js';
import checkSubscription from '../../shared/middlewares/checkSubscription.middleware.js';
import { checkUsageLimit } from '../../shared/middlewares/checkUsageLimit.middleware.js';
import { USAGE_RESOURCE } from '../billing/billing.constants.js';
import * as controller from './message.controller.js';
import * as v from '../../shared/validators/message.validator.js';

const messageRouter = express.Router();

// Every messaging route requires an authenticated tenant.
messageRouter.use(protect);

// ── Action routes ─────────────────────────────────────────────────────────────
// Each has a distinct leading static segment, so none collide with "/:id".

// Generate message records from a launched campaign.
messageRouter.post(
  '/process/:campaignId',
  v.campaignIdParam,
  validate,
  controller.processCampaign
);

// Send all pending messages of a campaign.
messageRouter.post(
  '/send-campaign/:campaignId',
  checkSubscription(),
  checkUsageLimit(USAGE_RESOURCE.MESSAGE),
  v.campaignIdParam,
  validate,
  controller.sendCampaign
);

// Send a single message.
messageRouter.post(
  '/send/:messageId',
  checkSubscription(),
  checkUsageLimit(USAGE_RESOURCE.MESSAGE),
  v.messageIdParam,
  validate,
  controller.sendMessage
);

// Retry a single failed message.
messageRouter.post(
  '/retry/:messageId',
  v.messageIdParam,
  validate,
  controller.retryMessage
);

// All messages for a campaign (two-segment path → never matches "/:id").
messageRouter.get(
  '/campaign/:campaignId',
  v.campaignMessages,
  validate,
  controller.getCampaignMessages
);

// ── Collection / single-resource routes ─────────────────────────────────────
messageRouter.get('/', v.listMessages, validate, controller.getMessages);
messageRouter.get('/:id', v.idParam, validate, controller.getMessage);

export default messageRouter;
