import SavedReply from "./savedReply.model.js";
import ApiError from "../../../utils/ApiError.js";

const DEFAULT_SAVED_REPLIES = [
  {
    title: "Greeting",
    body: "Thank you for contacting us. How may we assist you today?",
  },
  {
    title: "Lead Follow-up",
    body: "Thank you for your interest. I'll get back to you shortly with the details.",
  },
  {
    title: "Closing",
    body: "Thank you for reaching out. Please feel free to contact us again if you need any further support.",
  },
];

class SavedReplyService {
  /** Ensure the global defaults exist exactly once, shared by everyone.
   *  Safe to call repeatedly — no-ops once they exist. */
  async ensureGlobalDefaults() {
    const count = await SavedReply.countDocuments({ userId: null });
    if (count > 0) return;
    await SavedReply.insertMany(
      DEFAULT_SAVED_REPLIES.map((r) => ({ ...r, userId: null })),
    );
  }

  /** Global defaults + this user's own replies, oldest first. */
  async listSavedReplies(userId) {
    await this.ensureGlobalDefaults();
    return SavedReply.find({
      $or: [{ userId: null }, { userId }],
    })
      .sort({ createdAt: 1 })
      .lean();
  }

  async createSavedReply(userId, { title, body }) {
    if (!title?.trim()) throw new ApiError(400, "Title is required");
    if (!body?.trim()) throw new ApiError(400, "Body is required");

    return SavedReply.create({
      userId,
      title: title.trim(),
      body: body.trim(),
    });
  }

  async deleteSavedReply(userId, id) {
    const result = await SavedReply.findOneAndDelete({ _id: id, userId });
    if (!result) throw new ApiError(404, "Saved reply not found");
    return { _id: id, deleted: true };
  }
}

export default new SavedReplyService();