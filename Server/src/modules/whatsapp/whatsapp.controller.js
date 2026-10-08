import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import whatsappService from './whatsapp.service.js';
import { WHATSAPP_MESSAGES } from './whatsapp.constants.js';

// POST /api/whatsapp/connect
const connect = asyncHandler(async (req, res) => {
  await whatsappService.connectAccount(req.user.id, req.body);
  res.status(200).json(new ApiResponse(200, null, WHATSAPP_MESSAGES.CONNECTED));
});

// GET /api/whatsapp/status
const getStatus = asyncHandler(async (req, res) => {
  const data = await whatsappService.getStatus(req.user.id);
  res.status(200).json(new ApiResponse(200, data, WHATSAPP_MESSAGES.STATUS_FETCHED));
});

// GET /api/whatsapp/me
const getConnection = asyncHandler(async (req, res) => {
  const data = await whatsappService.getConnection(req.user.id);
  res.status(200).json(new ApiResponse(200, data, WHATSAPP_MESSAGES.CONNECTION_FETCHED));
});

// POST /api/whatsapp/disconnect
const disconnect = asyncHandler(async (req, res) => {
  await whatsappService.disconnectAccount(req.user.id);
  res.status(200).json(new ApiResponse(200, null, WHATSAPP_MESSAGES.DISCONNECTED));
});

// POST /api/whatsapp/sync
const sync = asyncHandler(async (req, res) => {
  const data = await whatsappService.syncConnection(req.user.id);
  res.status(200).json(new ApiResponse(200, data, WHATSAPP_MESSAGES.SYNCED));
});

const exchangeCode = asyncHandler(async (req, res) => {
  const data = await whatsappService.exchangeCode(req.user.id, req.body.code);
  res.status(200).json(new ApiResponse(200, data, WHATSAPP_MESSAGES.EXCHANGE_SUCCESS));
});

export { connect, getStatus, getConnection, disconnect, sync, exchangeCode };