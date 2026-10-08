import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import messageService from './message.service.js';
import { MESSAGE_MESSAGES } from './message.constants.js';

// POST /api/messages/process/:campaignId
const processCampaign = asyncHandler(async (req, res) => {
  const data = await messageService.processCampaign(
    req.user.id,
    req.params.campaignId
  );
  res.status(201).json(new ApiResponse(201, data, MESSAGE_MESSAGES.PROCESSED));
});

// POST /api/messages/send/:messageId
const sendMessage = asyncHandler(async (req, res) => {
  const data = await messageService.sendMessage(req.user.id, req.params.messageId);
  res.status(200).json(new ApiResponse(200, data, MESSAGE_MESSAGES.SENT));
});

// POST /api/messages/send-campaign/:campaignId
const sendCampaign = asyncHandler(async (req, res) => {
  const data = await messageService.sendCampaign(
    req.user.id,
    req.params.campaignId
  );
  res.status(200).json(new ApiResponse(200, data, MESSAGE_MESSAGES.CAMPAIGN_SENT));
});

// POST /api/messages/retry/:messageId
const retryMessage = asyncHandler(async (req, res) => {
  const data = await messageService.retryFailedMessage(
    req.user.id,
    req.params.messageId
  );
  res.status(200).json(new ApiResponse(200, data, MESSAGE_MESSAGES.RETRIED));
});

// GET /api/messages
const getMessages = asyncHandler(async (req, res) => {
  const data = await messageService.listMessages(req.user.id, req.query);
  res.status(200).json(new ApiResponse(200, data, MESSAGE_MESSAGES.LIST_FETCHED));
});

// GET /api/messages/:id
const getMessage = asyncHandler(async (req, res) => {
  const data = await messageService.getMessage(req.user.id, req.params.id);
  res.status(200).json(new ApiResponse(200, data, MESSAGE_MESSAGES.FETCHED));
});

// GET /api/messages/campaign/:campaignId
const getCampaignMessages = asyncHandler(async (req, res) => {
  const data = await messageService.getCampaignMessages(
    req.user.id,
    req.params.campaignId,
    req.query
  );
  res
    .status(200)
    .json(new ApiResponse(200, data, MESSAGE_MESSAGES.CAMPAIGN_MESSAGES_FETCHED));
});

export {
  processCampaign,
  sendMessage,
  sendCampaign,
  retryMessage,
  getMessages,
  getMessage,
  getCampaignMessages,
};
