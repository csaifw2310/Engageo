import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import analyticsService from './analytics.service.js';
import { ANALYTICS_MESSAGES } from './analytics.constants.js';

/**
 * Analytics controllers.
 *
 * Thin HTTP adapters: each pulls the authenticated tenant from `req.user.id`
 * (set by the `protect` middleware), delegates to the service, and wraps the
 * result in the project's standard ApiResponse envelope. No business logic
 * lives here. Every handler is wrapped in asyncHandler so rejected promises
 * flow to the global error middleware as consistent JSON.
 */

// GET /api/analytics/dashboard
const getDashboard = asyncHandler(async (req, res) => {
  const data = await analyticsService.getDashboard(req.user.id);
  res
    .status(200)
    .json(new ApiResponse(200, data, ANALYTICS_MESSAGES.DASHBOARD_FETCHED));
});

// GET /api/analytics/campaigns
const getCampaignAnalytics = asyncHandler(async (req, res) => {
  const data = await analyticsService.getCampaignAnalytics(
    req.user.id,
    req.query
  );
  res
    .status(200)
    .json(new ApiResponse(200, data, ANALYTICS_MESSAGES.CAMPAIGNS_FETCHED));
});

// GET /api/analytics/campaigns/:campaignId
const getCampaignById = asyncHandler(async (req, res) => {
  const data = await analyticsService.getCampaignById(
    req.user.id,
    req.params.campaignId
  );
  res
    .status(200)
    .json(new ApiResponse(200, data, ANALYTICS_MESSAGES.CAMPAIGN_FETCHED));
});

// GET /api/analytics/messages
const getMessageAnalytics = asyncHandler(async (req, res) => {
  const data = await analyticsService.getMessageAnalytics(req.user.id);
  res
    .status(200)
    .json(new ApiResponse(200, data, ANALYTICS_MESSAGES.MESSAGES_FETCHED));
});

// GET /api/analytics/contacts
const getContactAnalytics = asyncHandler(async (req, res) => {
  const data = await analyticsService.getContactAnalytics(req.user.id);
  res
    .status(200)
    .json(new ApiResponse(200, data, ANALYTICS_MESSAGES.CONTACTS_FETCHED));
});

// GET /api/analytics/groups
const getGroupAnalytics = asyncHandler(async (req, res) => {
  const data = await analyticsService.getGroupAnalytics(req.user.id);
  res
    .status(200)
    .json(new ApiResponse(200, data, ANALYTICS_MESSAGES.GROUPS_FETCHED));
});

// GET /api/analytics/trends
const getTrends = asyncHandler(async (req, res) => {
  const data = await analyticsService.getTrends(req.user.id, req.query);
  res
    .status(200)
    .json(new ApiResponse(200, data, ANALYTICS_MESSAGES.TRENDS_FETCHED));
});

// GET /api/analytics/top-campaigns
const getTopCampaigns = asyncHandler(async (req, res) => {
  const data = await analyticsService.getTopCampaigns(req.user.id);
  res
    .status(200)
    .json(
      new ApiResponse(200, data, ANALYTICS_MESSAGES.TOP_CAMPAIGNS_FETCHED)
    );
});

export {
  getDashboard,
  getCampaignAnalytics,
  getCampaignById,
  getMessageAnalytics,
  getContactAnalytics,
  getGroupAnalytics,
  getTrends,
  getTopCampaigns,
};
