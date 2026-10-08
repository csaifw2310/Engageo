import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import notificationService from './notification.service.js';
import { NOTIFICATION_MESSAGES } from './notification.constants.js';

const getNotifications = asyncHandler(async (req, res) => {
  const result = await notificationService.list(req.user.id, req.query);
  res.status(200).json(new ApiResponse(200, result, NOTIFICATION_MESSAGES.FETCHED));
});

const getUnreadCount = asyncHandler(async (req, res) => {
  const result = await notificationService.getUnreadCount(req.user.id);
  res.status(200).json(new ApiResponse(200, result, NOTIFICATION_MESSAGES.UNREAD_COUNT_FETCHED));
});

const getNotification = asyncHandler(async (req, res) => {
  const notification = await notificationService.getById(req.user.id, req.params.id);
  res.status(200).json(new ApiResponse(200, notification, NOTIFICATION_MESSAGES.FETCHED));
});

const markRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markRead(req.user.id, req.params.id);
  res.status(200).json(new ApiResponse(200, notification, NOTIFICATION_MESSAGES.MARKED_READ));
});

const markAllRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllRead(req.user.id);
  res.status(200).json(new ApiResponse(200, result, NOTIFICATION_MESSAGES.ALL_MARKED_READ));
});

const deleteNotification = asyncHandler(async (req, res) => {
  await notificationService.remove(req.user.id, req.params.id);
  res.status(200).json(new ApiResponse(200, null, NOTIFICATION_MESSAGES.DELETED));
});

const deleteAllNotifications = asyncHandler(async (req, res) => {
  const result = await notificationService.removeAll(req.user.id);
  res.status(200).json(new ApiResponse(200, result, NOTIFICATION_MESSAGES.DELETED));
});

export {
  getNotifications,
  getUnreadCount,
  getNotification,
  markRead,
  markAllRead,
  deleteNotification,
  deleteAllNotifications,
};