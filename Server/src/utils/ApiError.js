/**
 * Operational error carrying an HTTP status code.
 * Anything thrown from services/controllers using this class is treated
 * as a known, client-facing error by the global error handler.
 */
class ApiError extends Error {
  constructor(statusCode, message, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.success = false;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default ApiError;
