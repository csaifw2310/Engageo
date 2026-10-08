import { query, param } from 'express-validator';

import { NOTIFICATION_TYPE_VALUES } from '../../modules/notifications/notification.constants.js';

const listNotifications = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100').toInt(),
  query('type').optional().isIn(NOTIFICATION_TYPE_VALUES).withMessage('Invalid notification type'),
  query('read').optional().isBoolean().withMessage('read must be true or false').toBoolean(),
];

const notificationIdParam = [param('id').isMongoId().withMessage('Invalid notification id')];

export { listNotifications, notificationIdParam };