import express from 'express';

import { protect } from '../../shared/middlewares/auth.middleware.js';
import validate from '../../shared/middlewares/validate.middleware.js';
import * as controller from './analytics.controller.js';
import * as v from '../../shared/validators/analytics.validation.js';

const analyticsRouter = express.Router();

/**
 * Analytics is a READ-ONLY, tenant-scoped reporting surface. Every route below
 * requires an authenticated tenant — `protect` populates req.user.id, and every
 * service/repository query is scoped to that id, so a tenant only ever sees its
 * own analytics. There are no write verbs in this module by design.
 */
analyticsRouter.use(protect);

// Top-level dashboard metrics.
analyticsRouter.get('/dashboard', controller.getDashboard);

// Campaign analytics. The static collection route is declared before the
// parameterised single-campaign route so "/campaigns" never falls through to
// the "/:campaignId" matcher.
analyticsRouter.get(
  '/campaigns',
  v.listCampaigns,
  validate,
  controller.getCampaignAnalytics
);
analyticsRouter.get(
  '/campaigns/:campaignId',
  v.campaignIdParam,
  validate,
  controller.getCampaignById
);

// Aggregate breakdowns.
analyticsRouter.get('/messages', controller.getMessageAnalytics);
analyticsRouter.get('/contacts', controller.getContactAnalytics);
analyticsRouter.get('/groups', controller.getGroupAnalytics);

// Time-series + leaderboard.
analyticsRouter.get('/trends', v.trends, validate, controller.getTrends);
analyticsRouter.get('/top-campaigns', controller.getTopCampaigns);

export default analyticsRouter;
