import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import savedReplyService from "./savedReply.service.js";

// GET /api/saved-replies
const listSavedReplies = asyncHandler(async (req, res) => {
  const data = await savedReplyService.listSavedReplies(req.user.id);
  res
    .status(200)
    .json(new ApiResponse(200, data, "Saved replies fetched successfully"));
});

// POST /api/saved-replies
const createSavedReply = asyncHandler(async (req, res) => {
  const data = await savedReplyService.createSavedReply(req.user.id, req.body);
  res.status(201).json(new ApiResponse(201, data, "Saved reply created"));
});

// DELETE /api/saved-replies/:id
const deleteSavedReply = asyncHandler(async (req, res) => {
  const data = await savedReplyService.deleteSavedReply(
    req.user.id,
    req.params.id,
  );
  res.status(200).json(new ApiResponse(200, data, "Saved reply deleted"));
});

export { listSavedReplies, createSavedReply, deleteSavedReply };