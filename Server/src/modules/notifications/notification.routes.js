import express from 'express';

import authenticate from '../../shared/middlewares/auth.middleware.js';
import validate from '../../shared/middlewares/validate.middleware.js';
import * as controller from './notification.controller.js';
import * as v from '../../shared/validators/notification.validator.js';

const notificationRouter = express.Router();

// Every notification route requires a valid JWT.
notificationRouter.use(authenticate);

/**
 * IMPORTANT: static paths (/unread-count, /read-all) MUST be declared before
 * "/:id", otherwise Express would match them as an :id parameter.
 */
notificationRouter.get('/unread-count', controller.getUnreadCount);
notificationRouter.patch('/read-all', controller.markAllRead);
notificationRouter.delete('/', controller.deleteAllNotifications);

notificationRouter.get('/', v.listNotifications, validate, controller.getNotifications);

notificationRouter
  .route('/:id')
  .get(v.notificationIdParam, validate, controller.getNotification)
  .delete(v.notificationIdParam, validate, controller.deleteNotification);

notificationRouter.patch(
  '/:id/read',
  v.notificationIdParam,
  validate,
  controller.markRead
);

export default notificationRouter;