import express from "express";
import { protect } from "../../../shared/middlewares/auth.middleware.js";
import * as controller from "./savedReply.controller.js";

const savedReplyRouter = express.Router();

savedReplyRouter.use(protect);

savedReplyRouter.get("/", controller.listSavedReplies);
savedReplyRouter.post("/", controller.createSavedReply);
savedReplyRouter.delete("/:id", controller.deleteSavedReply);

export default savedReplyRouter;