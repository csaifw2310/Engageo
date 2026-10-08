import mongoose from "mongoose";

/**
 * SavedReply
 *
 * Reusable quick-reply snippets a tenant's team can insert into the chat
 * composer. Two kinds of documents live in this same collection:
 *   - userId: null  → global defaults, visible to every user, not deletable
 *                      via the normal delete route.
 *   - userId: <id>   → created by that user, visible only to them.
 */
const savedReplySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [80, "Title cannot exceed 80 characters"],
    },

    body: {
      type: String,
      required: [true, "Body is required"],
      trim: true,
      maxlength: [1000, "Body cannot exceed 1000 characters"],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

savedReplySchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("SavedReply", savedReplySchema);