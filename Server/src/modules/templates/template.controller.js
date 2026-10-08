import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import templateService from './template.service.js';
import { TEMPLATE_MESSAGES } from './template.constants.js';

// POST /api/templates
const createTemplate = asyncHandler(async (req, res) => {
  const data = await templateService.createTemplate(req.user.id, req.body);
  res.status(201).json(new ApiResponse(201, data, TEMPLATE_MESSAGES.CREATED));
});

// POST /api/templates/header-media  (multipart/form-data: file + headerType)
const uploadTemplateHeaderMedia = asyncHandler(async (req, res) => {
  const data = await templateService.uploadHeaderMedia(req.user.id, {
    headerType: req.body.headerType,
    file: req.file,
  });
  res.status(200).json(new ApiResponse(200, data, 'Header media uploaded successfully'));
});

// GET /api/templates
const getTemplates = asyncHandler(async (req, res) => {
  const data = await templateService.listTemplates(req.user.id, req.query);
  res.status(200).json(new ApiResponse(200, data, TEMPLATE_MESSAGES.LIST_FETCHED));
});

// GET /api/templates/:id
const getTemplate = asyncHandler(async (req, res) => {
  const data = await templateService.getTemplate(req.user.id, req.params.id);
  res.status(200).json(new ApiResponse(200, data, TEMPLATE_MESSAGES.FETCHED));
});

// POST /api/templates/sync
const syncTemplates = asyncHandler(async (req, res) => {
  const data = await templateService.syncTemplates(req.user.id);
  res.status(200).json(new ApiResponse(200, data, TEMPLATE_MESSAGES.SYNCED));
});

// DELETE /api/templates/:id
const deleteTemplate = asyncHandler(async (req, res) => {
  await templateService.deleteTemplate(req.user.id, req.params.id);
  res.status(200).json(new ApiResponse(200, null, TEMPLATE_MESSAGES.DELETED));
});

export {
  getTemplates,
  getTemplate,
  syncTemplates,
  deleteTemplate,
  createTemplate,
  uploadTemplateHeaderMedia,
};
