import express from 'express';

import { protect } from '../../shared/middlewares/auth.middleware.js';
import validate from '../../shared/middlewares/validate.middleware.js';
import uploadCsv from '../../shared/middlewares/multer.js';
import * as controller from './settings.controller.js';
import * as v from '../../shared/validators/settings.validation.js';

const settingsRouter = express.Router();

settingsRouter.use(protect);

// ── Complete settings ─────────────────────────────────────────────────────────
settingsRouter.get('/', controller.getSettings);
settingsRouter.patch('/', v.updateSettings, validate, controller.updateSettings);

// ── Profile ───────────────────────────────────────────────────────────────────
settingsRouter.get('/profile', controller.getProfile);
settingsRouter.patch('/profile', v.updateProfile, validate, controller.updateProfile);
settingsRouter.post('/profile/avatar', uploadCsv.single('avatar'), controller.uploadAvatar);

// ── Business information ──────────────────────────────────────────────────────
settingsRouter.get('/business', controller.getBusiness);
settingsRouter.patch('/business', v.updateBusiness, validate, controller.updateBusiness);

// ── Notification preferences ──────────────────────────────────────────────────
settingsRouter.get('/notifications', controller.getNotifications);
settingsRouter.patch('/notifications', v.updateNotifications, validate, controller.updateNotifications);

// ── Preferences ───────────────────────────────────────────────────────────────
settingsRouter.get('/preferences', controller.getPreferences);
settingsRouter.patch('/preferences', v.updatePreferences, validate, controller.updatePreferences);

export default settingsRouter;
