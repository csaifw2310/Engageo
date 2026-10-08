import mongoose from 'mongoose';

import {
  NOTIFICATION_TYPE_VALUES,
  NOTIFICATION_EVENT_VALUES,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_PRIORITY_VALUES,
} from './notification.constants.js';

const notificationSchema = new mongoose.Schema(
  {
    // Tenant owner. Every query is scoped by this field — a notification is
    // only ever visible to the user it was created for.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Broad category — drives the icon/route on the frontend.
    type: {
      type: String,
      enum: {
        values: NOTIFICATION_TYPE_VALUES,
        message: `type must be one of: ${NOTIFICATION_TYPE_VALUES.join(', ')}`,
      },
      required: true,
    },

    // Fine-grained business event that generated this notification.
    event: {
      type: String,
      enum: {
        values: NOTIFICATION_EVENT_VALUES,
        message: `event must be one of: ${NOTIFICATION_EVENT_VALUES.join(', ')}`,
      },
      required: true,
    },

    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },

    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },

    priority: {
      type: String,
      enum: {
        values: NOTIFICATION_PRIORITY_VALUES,
        message: `priority must be one of: ${NOTIFICATION_PRIORITY_VALUES.join(', ')}`,
      },
      default: NOTIFICATION_PRIORITY.NORMAL,
    },

    // Free-form payload (e.g. { campaignId, name } or { paymentId, amount }).
    // Lets the frontend deep-link / render extra context without another
    // round trip, while keeping the schema stable as new event types appear.
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    read: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
    versionKey: false,
  }
);

// Primary listing path: a tenant's notifications newest-first.
notificationSchema.index({ userId: 1, createdAt: -1 });

// Unread listing + unread-count queries (bell dropdown, badge).
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

// Filtering the notification center by category.
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);