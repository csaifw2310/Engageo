import express from "express";
import { protect } from "../../shared/middlewares/auth.middleware.js";
import { uploadChatAttachment, uploadVoiceNote } from "../../shared/middlewares/multer.js";
import { uploadMedia } from "./media.controller.js";

const mediaRouter = express.Router();

mediaRouter.use(protect);

// General attach-file button (images, videos, documents) — looser 25MB cap.
mediaRouter.post("/upload", uploadChatAttachment.single("file"), uploadMedia);

// Mic/voice-note button — tighter 6MB cap, audio-only.
mediaRouter.post("/upload/voice-note", uploadVoiceNote.single("file"), uploadMedia);

export default mediaRouter;