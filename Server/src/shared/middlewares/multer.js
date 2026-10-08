import multer from "multer";
import ApiError from "../../utils/ApiError.js";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const isCsv =
    file.mimetype === "text/csv" ||
    file.mimetype === "application/vnd.ms-excel" ||
    file.mimetype === "application/csv" ||
    file.originalname.toLowerCase().endsWith(".csv");

  const isImage =
    file.mimetype.startsWith("image/") &&
    ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.mimetype);

  if (!isCsv && !isImage) return cb(new ApiError(400, "Only CSV or image files are allowed"));
  return cb(null, true);
};

const uploadCsv = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

// ── Template header media (image / video / document samples) ────────────────
// Separate instance so its (looser, larger) limits never affect the CSV/
// contact-photo path above. Exact per-type mime/size rules (image ≤5MB,
// video ≤16MB, document ≤100MB) are enforced in template.service.js — this
// filter only rejects mime types no header type accepts at all, and the
// limit here is the widest of the three (document) so multer never rejects a
// file the service would otherwise validate with a clearer, per-type message.
const templateMediaFileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg',
    'image/png',
    'video/mp4',
    'video/3gpp',
    'application/pdf',
  ];
  if (!allowed.includes(file.mimetype)) {
    return cb(new ApiError(400, 'This file type is not accepted for a template header'));
  }
  return cb(null, true);
};

const uploadTemplateMedia = multer({
  storage,
  fileFilter: templateMediaFileFilter,
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
});

// ── Chat attachments (voice notes + inbox file attach) ───────────────────────
// Used by the conversation panel's mic button (VoiceRecorder → webm blob)
// and its "Attach file" button. Broad category gate only — audio, image,
// video (webm recordings arrive as video/webm in some browsers), and common
// document mimetypes. Business-specific rules (if any) stay in the media
// service, same split as templateMediaFileFilter above.
const chatAttachmentFileFilter = (req, file, cb) => {
  const isAudio = file.mimetype.startsWith("audio/");
  const isImage = file.mimetype.startsWith("image/");
  const isVideo = file.mimetype.startsWith("video/");
  const isDoc =
    file.mimetype === "application/pdf" ||
    file.mimetype === "application/msword" ||
    file.mimetype.startsWith("application/vnd.");

  if (!isAudio && !isImage && !isVideo && !isDoc) {
    return cb(new ApiError(400, "This file type is not supported for chat attachments"));
  }
  return cb(null, true);
};

// Audio gets a tighter cap than the general 25MB chat-attachment limit — a
// 2-minute voice note (webm/opus) is realistically 1-3MB, so 6MB is a
// generous ceiling that still rejects anything wildly out of bounds (e.g. a
// bypassed frontend timer, or a non-voice-note audio file someone tries to
// smuggle through the mic upload path) well before it reaches Cloudinary.
const AUDIO_MAX_BYTES = 6 * 1024 * 1024;

const uploadChatAttachment = multer({
  storage,
  fileFilter: chatAttachmentFileFilter,
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});

// Stricter instance specifically for the mic/voice-note upload endpoint.
// The general uploadChatAttachment (25MB) still covers file-attach for
// images/videos/documents where larger sizes are legitimate.
const uploadVoiceNote = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("audio/") && !file.mimetype.startsWith("video/")) {
      // video/webm is what MediaRecorder produces in some browsers for audio-only capture
      return cb(new ApiError(400, "Only audio recordings are allowed here"));
    }
    return cb(null, true);
  },
  limits: { fileSize: AUDIO_MAX_BYTES, files: 1 },
});

export default uploadCsv;
export { uploadTemplateMedia, uploadChatAttachment, uploadVoiceNote };