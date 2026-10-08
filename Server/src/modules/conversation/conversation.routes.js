import express from "express";
import { protect } from "../../shared/middlewares/auth.middleware.js";
import * as controller from "./conversation.controller.js";
import savedReplyRouter from "../conversation/saved-replies/savedReply.routes.js";

const conversationRouter = express.Router();

conversationRouter.use(protect);

conversationRouter.get("/", controller.listConversations);
conversationRouter.post("/", controller.createConversation);

//  MUST come before "/:id" — otherwise "/saved-replies" matches :id first
conversationRouter.use("/saved-replies", savedReplyRouter);

conversationRouter.get("/:id", controller.getConversation);
conversationRouter.get("/:id/messages", controller.getMessages);
conversationRouter.post("/:id/messages", controller.sendMessage);
conversationRouter.post("/:id/read", controller.markAsRead);
conversationRouter.patch("/:id/status", controller.updateStatus);
conversationRouter.patch("/:id/archive", controller.archiveConversation);
conversationRouter.patch("/:id/unarchive", controller.unarchiveConversation);
conversationRouter.patch("/:id/notes", controller.updateNotes);
conversationRouter.patch("/:id/display-name", controller.updateDisplayName);
conversationRouter.patch("/:id/preferences", controller.updatePreferences);
conversationRouter.get("/:id/matching-contact", controller.findMatchingContact);
conversationRouter.patch("/:id/link-contact", controller.linkContact);
conversationRouter.post("/:id/contact", controller.createAndLinkContact);
conversationRouter.delete("/:id/messages/:messageId", controller.deleteMessageForMe);

export default conversationRouter;