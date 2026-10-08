import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import ApiError from '../../utils/ApiError.js';
import settingsService from './settings.service.js';
import { SETTINGS_MESSAGES } from './settings.constants.js';

/**
 * Settings controllers.
 *
 * Thin HTTP adapters: each pulls the authenticated tenant from `req.user.id`
 * (set by the `protect` middleware), delegates to the service, and wraps the
 * result in the project's standard ApiResponse envelope. No business logic
 * lives here. Every handler is wrapped in asyncHandler so rejected promises
 * flow to the global error middleware as consistent JSON.
 */

// ── Complete settings ─────────────────────────────────────────────────────────

// GET /api/settings
const getSettings = asyncHandler(async (req, res) => {
  const data = await settingsService.getSettings(req.user.id);
  res
    .status(200)
    .json(new ApiResponse(200, data, SETTINGS_MESSAGES.FETCHED));
});

// PATCH /api/settings
const updateSettings = asyncHandler(async (req, res) => {
  const data = await settingsService.updateSettings(req.user.id, req.body);
  res
    .status(200)
    .json(new ApiResponse(200, data, SETTINGS_MESSAGES.UPDATED));
});

// ── Profile ───────────────────────────────────────────────────────────────────

// GET /api/settings/profile
const getProfile = asyncHandler(async (req, res) => {
  const data = await settingsService.getProfile(req.user.id);
  res
    .status(200)
    .json(new ApiResponse(200, data, SETTINGS_MESSAGES.PROFILE_FETCHED));
});

// PATCH /api/settings/profile
const updateProfile = asyncHandler(async (req, res) => {
  const data = await settingsService.updateProfile(req.user.id, req.body);
  res
    .status(200)
    .json(new ApiResponse(200, data, SETTINGS_MESSAGES.PROFILE_UPDATED));
});

// ── Business information ──────────────────────────────────────────────────────

// GET /api/settings/business
const getBusiness = asyncHandler(async (req, res) => {
  const data = await settingsService.getBusiness(req.user.id);
  res
    .status(200)
    .json(new ApiResponse(200, data, SETTINGS_MESSAGES.BUSINESS_FETCHED));
});

// PATCH /api/settings/business
const updateBusiness = asyncHandler(async (req, res) => {
  const data = await settingsService.updateBusiness(req.user.id, req.body);
  res
    .status(200)
    .json(new ApiResponse(200, data, SETTINGS_MESSAGES.BUSINESS_UPDATED));
});

// ── Notification preferences ──────────────────────────────────────────────────

// GET /api/settings/notifications
const getNotifications = asyncHandler(async (req, res) => {
  const data = await settingsService.getNotifications(req.user.id);
  res
    .status(200)
    .json(new ApiResponse(200, data, SETTINGS_MESSAGES.NOTIFICATIONS_FETCHED));
});

// PATCH /api/settings/notifications
const updateNotifications = asyncHandler(async (req, res) => {
  const data = await settingsService.updateNotifications(req.user.id, req.body);
  res
    .status(200)
    .json(new ApiResponse(200, data, SETTINGS_MESSAGES.NOTIFICATIONS_UPDATED));
});

// ── Preferences ───────────────────────────────────────────────────────────────

// GET /api/settings/preferences
const getPreferences = asyncHandler(async (req, res) => {
  const data = await settingsService.getPreferences(req.user.id);
  res
    .status(200)
    .json(new ApiResponse(200, data, SETTINGS_MESSAGES.PREFERENCES_FETCHED));
});

// PATCH /api/settings/preferences
const updatePreferences = asyncHandler(async (req, res) => {
  const data = await settingsService.updatePreferences(req.user.id, req.body);
  res
    .status(200)
    .json(new ApiResponse(200, data, SETTINGS_MESSAGES.PREFERENCES_UPDATED));
});

// POST /api/settings/profile/avatar
const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Image file is required');
  const b64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  const data = await settingsService.updateProfile(req.user.id, { avatarUrl: b64 });
  res.status(200).json(new ApiResponse(200, data, 'Avatar updated successfully'));
});

export {
  getSettings,
  updateSettings,
  getProfile,
  updateProfile,
  getBusiness,
  updateBusiness,
  getNotifications,
  updateNotifications,
  getPreferences,
  updatePreferences,
  uploadAvatar,
};
