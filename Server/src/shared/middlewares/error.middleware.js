import multer from "multer";
import ApiError from "../../utils/ApiError.js";

/**
 * Centralized error handler. Mount LAST, after all routes:
 *   app.use(errorHandler);
 *
 * Normalizes Mongoose/Multer/unknown errors into the ApiError shape and
 * returns a consistent JSON body: { success: false, message, errors? }
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Mongo duplicate key (e.g. duplicate phone per user, duplicate group name)
  if (err && err.code === 11000) {
    const fields = Object.keys(err.keyValue || {});
    error = new ApiError(409, `Duplicate value for: ${fields.join(", ")}`, [
      { fields, value: err.keyValue },
    ]);
  }

  // Mongoose schema validation
  if (err && err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    error = new ApiError(422, "Validation failed", errors);
  }

  // Invalid ObjectId etc.
  if (err && err.name === "CastError") {
    error = new ApiError(400, `Invalid value for "${err.path}"`);
  }

  // Multer upload errors (file too large, etc.)
  if (err instanceof multer.MulterError) {
    error = new ApiError(400, `Upload error: ${err.message}`);
  }

  // Fallback: anything not already an ApiError becomes a 500
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    error = new ApiError(statusCode, error.message || "Internal Server Error");
  }

  const body = {
    success: false,
    message: error.message,
  };
  if (error.errors && error.errors.length) body.errors = error.errors;
  if (process.env.NODE_ENV !== "production") body.stack = err.stack;

  // Avoid leaking internals on unexpected 500s in production
  if (error.statusCode >= 500 && process.env.NODE_ENV === "production") {
    body.message = "Internal Server Error";
  }

  res.status(error.statusCode).json(body);
};

export default errorHandler;
