import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import campaignService from "./campaign.service.js";
import { CAMPAIGN_MESSAGES } from "./campaign.constants.js";
import messageService from "../message/message.service.js";

// POST /api/campaigns
const createCampaign = asyncHandler(async (req, res) => {
  const data = await campaignService.createCampaign(req.user.id, req.body);
  res.status(201).json(new ApiResponse(201, data, CAMPAIGN_MESSAGES.CREATED));
});

// GET /api/campaigns
const getCampaigns = asyncHandler(async (req, res) => {
  const data = await campaignService.listCampaigns(req.user.id, req.query);
  res
    .status(200)
    .json(new ApiResponse(200, data, CAMPAIGN_MESSAGES.LIST_FETCHED));
});

// GET /api/campaigns/:id
const getCampaign = asyncHandler(async (req, res) => {
  const data = await campaignService.getCampaign(req.user.id, req.params.id);
  res.status(200).json(new ApiResponse(200, data, CAMPAIGN_MESSAGES.FETCHED));
});

// PATCH /api/campaigns/:id
const updateCampaign = asyncHandler(async (req, res) => {
  const data = await campaignService.updateCampaign(
    req.user.id,
    req.params.id,
    req.body,
  );
  res.status(200).json(new ApiResponse(200, data, CAMPAIGN_MESSAGES.UPDATED));
});

// DELETE /api/campaigns/:id
const deleteCampaign = asyncHandler(async (req, res) => {
  await campaignService.deleteCampaign(req.user.id, req.params.id);
  res.status(200).json(new ApiResponse(200, null, CAMPAIGN_MESSAGES.DELETED));
});

// POST /api/campaigns/:id/schedule
const scheduleCampaign = asyncHandler(async (req, res) => {
  const data = await campaignService.scheduleCampaign(
    req.user.id,
    req.params.id,
    req.body.scheduledAt,
  );
  res.status(200).json(new ApiResponse(200, data, CAMPAIGN_MESSAGES.SCHEDULED));
});

// POST /api/campaigns/:id/launch
// POST /api/campaigns/:id/launch
const launchCampaign = asyncHandler(async (req, res) => {
  const campaign = await campaignService.launchCampaign(
    req.user.id,
    req.params.id,
  );

  // Create message documents
  await messageService.processCampaign(req.user.id, campaign._id);

  // Send WhatsApp messages
  await messageService.sendCampaign(req.user.id, campaign._id);

  res
    .status(200)
    .json(new ApiResponse(200, campaign, CAMPAIGN_MESSAGES.LAUNCHED));
});

// POST /api/campaigns/:id/cancel
const cancelCampaign = asyncHandler(async (req, res) => {
  const data = await campaignService.cancelCampaign(req.user.id, req.params.id);
  res.status(200).json(new ApiResponse(200, data, CAMPAIGN_MESSAGES.CANCELLED));
});

export {
  createCampaign,
  getCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  scheduleCampaign,
  launchCampaign,
  cancelCampaign,
};
