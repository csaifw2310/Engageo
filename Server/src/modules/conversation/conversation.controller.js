import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import conversationService from "./conversation.service.js";

const listConversations = asyncHandler(async (req, res) => {
  const data = await conversationService.listConversations(
    req.user.id,
    req.query,
  );
  res
    .status(200)
    .json(new ApiResponse(200, data, "Conversations fetched successfully"));
});

const getConversation = asyncHandler(async (req, res) => {
  const data = await conversationService.getConversation(
    req.user.id,
    req.params.id,
  );
  res
    .status(200)
    .json(new ApiResponse(200, data, "Conversation fetched successfully"));
});

const getMessages = asyncHandler(async (req, res) => {
  const data = await conversationService.getMessages(
    req.user.id,
    req.params.id,
    req.query,
  );
  res
    .status(200)
    .json(new ApiResponse(200, data, "Messages fetched successfully"));
});

const markAsRead = asyncHandler(async (req, res) => {
  const data = await conversationService.markAsRead(req.user.id, req.params.id);
  res.status(200).json(new ApiResponse(200, data, "Marked as read"));
});

const updateStatus = asyncHandler(async (req, res) => {
  const data = await conversationService.updateStatus(
    req.user.id,
    req.params.id,
    req.body.status,
  );
  res.status(200).json(new ApiResponse(200, data, "Status updated"));
});

const createConversation = asyncHandler(async (req, res) => {
  const data = await conversationService.getOrCreateByPhone(
    req.user.id,
    req.body.phoneNumber,
    req.body.displayName,
  );
  res.status(200).json(new ApiResponse(200, data, "Conversation ready"));
});

const sendMessage = asyncHandler(async (req, res) => {
  const { content, mediaUrl, mediaType, durationSec, filename, fileSize } =
    req.body;
  // `filename` only matters for document sends — the Cloud API uses it as the
  // name the recipient sees on the document card. Without it WhatsApp falls
  // back to the Cloudinary public_id, which looks like a random string.
  const media = mediaUrl
    ? { mediaUrl, mediaType, durationSec, filename, fileSize }
    : null;
  const data = await conversationService.sendMessage(
    req.user.id,
    req.params.id,
    content,
    media,
  );
  res.status(200).json(new ApiResponse(200, data, "Message sent successfully"));
});

// NEW
const archiveConversation = asyncHandler(async (req, res) => {
  const data = await conversationService.archiveConversation(
    req.user.id,
    req.params.id,
  );
  res.status(200).json(new ApiResponse(200, data, "Conversation archived"));
});

const unarchiveConversation = asyncHandler(async (req, res) => {
  const data = await conversationService.unarchiveConversation(
    req.user.id,
    req.params.id,
  );
  res.status(200).json(new ApiResponse(200, data, "Conversation unarchived"));
});

const updateNotes = asyncHandler(async (req, res) => {
  const data = await conversationService.updateNotes(
    req.user.id,
    req.params.id,
    req.body.notes,
  );
  res.status(200).json(new ApiResponse(200, data, "Notes updated"));
});

const updatePreferences = asyncHandler(async (req, res) => {
  const data = await conversationService.updatePreferences(
    req.user.id,
    req.params.id,
    req.body,
  );
  res.status(200).json(new ApiResponse(200, data, "Preferences updated"));
});

const updateDisplayName = asyncHandler(async (req, res) => {
  const data = await conversationService.updateDisplayName(
    req.user.id,
    req.params.id,
    req.body.displayName,
  );
  res.status(200).json(new ApiResponse(200, data, "Name updated"));
});

const findMatchingContact = asyncHandler(async (req, res) => {
  const data = await conversationService.findMatchingContact(
    req.user.id,
    req.params.id,
  );
  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        data,
        data ? "Matching contact found" : "No matching contact",
      ),
    );
});

const linkContact = asyncHandler(async (req, res) => {
  const data = await conversationService.linkContact(
    req.user.id,
    req.params.id,
    req.body.contactId,
  );
  res
    .status(200)
    .json(new ApiResponse(200, data, "Contact linked successfully"));
});

const createAndLinkContact = asyncHandler(async (req, res) => {
  const data = await conversationService.createAndLinkContact(
    req.user.id,
    req.params.id,
    req.body,
  );
  res
    .status(200)
    .json(
      new ApiResponse(200, data, "Contact created and linked successfully"),
    );
});

// NEW — soft delete: hides one message from the requesting user's view only.
const deleteMessageForMe = asyncHandler(async (req, res) => {
  const data = await conversationService.deleteMessageForMe(
    req.user.id,
    req.params.id,
    req.params.messageId,
  );
  res.status(200).json(new ApiResponse(200, data, "Message deleted"));
});

export {
  listConversations,
  getConversation,
  getMessages,
  markAsRead,
  updateStatus,
  sendMessage,
  createConversation,
  archiveConversation,
  unarchiveConversation,
  updatePreferences,
  updateNotes,
  updateDisplayName,
  findMatchingContact,
  linkContact,
  createAndLinkContact,
  deleteMessageForMe,
};