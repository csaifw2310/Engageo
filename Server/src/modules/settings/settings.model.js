import mongoose from "mongoose";

import {
  DEFAULT_NOTIFICATIONS,
  DEFAULT_TIMEZONE,
} from "./settings.constants.js";

/**
 * UserSettings model.
 *
 * One document per user (enforced by the unique index on `userId`). The
 * document is auto-created with sensible defaults on first access so the
 * caller never has to handle a missing-settings edge case explicitly.
 *
 * Sub-documents intentionally use plain nested schemas (not sub-document
 * arrays or embedded models) to keep the partial-update logic in the service
 * simple: a dot-notation $set is all that is needed.
 */
const userSettingsSchema = new mongoose.Schema(
  {
    /** Reference to the owning user. Unique — one settings doc per user. */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // ── Profile ──────────────────────────────────────────────────────────────
    profile: {
      fullName: { type: String, trim: true, default: "" },
      phoneNumber: { type: String, trim: true, default: "" },
      avatarUrl: { type: String, trim: true, default: "" },
    },

    // ── Business information ──────────────────────────────────────────────────
    business: {
      businessName: { type: String, trim: true, default: "" },
      website: { type: String, trim: true, default: "" },
      industry: { type: String, trim: true, default: "" },
      address: { type: String, trim: true, default: "" },
    },

    // ── Notification preferences ──────────────────────────────────────────────
    notifications: {
      emailNotifications: {
        type: Boolean,
        default: DEFAULT_NOTIFICATIONS.emailNotifications,
      },
      incomingMessages: {
        type: Boolean,
        default: true,
      },
      campaignCompleted: {
        type: Boolean,
        default: DEFAULT_NOTIFICATIONS.campaignCompleted,
      },
      campaignFailed: {
        type: Boolean,
        default: DEFAULT_NOTIFICATIONS.campaignFailed,
      },
      paymentAlerts: {
        type: Boolean,
        default: DEFAULT_NOTIFICATIONS.paymentAlerts,
      },
      subscriptionAlerts: {
        type: Boolean,
        default: DEFAULT_NOTIFICATIONS.subscriptionAlerts,
      },
    },

    // ── Preferences ───────────────────────────────────────────────────────────
    preferences: {
      timezone: { type: String, default: DEFAULT_TIMEZONE },
      theme: { type: String, enum: ["dark", "light"], default: "dark" },
    },

    // ── Profile avatar ────────────────────────────────────────────────────────
    avatarUrl: { type: String, default: "" },
  },
  {
    timestamps: true,
    // Never return the Mongoose version key (__v) in responses.
    versionKey: false,
  },
);

const UserSettings = mongoose.model("UserSettings", userSettingsSchema);

export default UserSettings;
