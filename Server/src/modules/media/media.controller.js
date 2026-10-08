import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import ApiError from "../../utils/ApiError.js";
import cloudinary from "../../config/cloudinary.js";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { PassThrough } from "node:stream";

ffmpeg.setFfmpegPath(ffmpegPath);

function uploadBufferToCloudinary(buffer, folder, resourceType) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      },
    );
    stream.end(buffer);
  });
}

// Converts an in-memory audio buffer (webm/opus from MediaRecorder) into
// ogg/opus — one of the few audio formats WhatsApp's Cloud API actually
// accepts for outbound media messages. Without this, uploads succeed (the
// file lands fine on Cloudinary) but Meta silently fails to deliver the
// message to the recipient because it can't process the source format.
function convertToOggOpus(inputBuffer) {
  return new Promise((resolve, reject) => {
    const input = new PassThrough();
    input.end(inputBuffer);

    const chunks = [];
    const output = new PassThrough();
    output.on("data", (chunk) => chunks.push(chunk));
    output.on("end", () => resolve(Buffer.concat(chunks)));
    output.on("error", reject);

    ffmpeg(input)
      .audioCodec("libopus")
      .format("ogg")
      .on("error", reject)
      .pipe(output, { end: true });
  });
}

const uploadMedia = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "No file provided");

  const mimeType = req.file.mimetype || "";
  const isAudio = mimeType.startsWith("audio/") || mimeType.startsWith("video/webm");

  let bufferToUpload = req.file.buffer;
  let resourceType = mimeType.startsWith("image/")
    ? "image"
    : mimeType.startsWith("audio/") || mimeType.startsWith("video/")
      ? "video"
      : "raw";
  let finalMimeType = mimeType;

  // Only convert what's actually a voice-note/audio recording — this is
  // the mic path (webm), not general image/document attachments.
  if (isAudio) {
    try {
      bufferToUpload = await convertToOggOpus(req.file.buffer);
      finalMimeType = "audio/ogg";
    } catch (err) {
      throw new ApiError(500, `Audio conversion failed: ${err.message}`);
    }
  }

  const result = await uploadBufferToCloudinary(
    bufferToUpload,
    `engageo/${req.user.id}`,
    resourceType,
  );

  res.status(200).json(
    new ApiResponse(200, {
      url: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type,
      format: result.format,
      bytes: result.bytes,
      originalName: req.file.originalname,
      mimeType: finalMimeType,
    }, "File uploaded"),
  );
});

export { uploadMedia };