/**
 * Wraps an async route handler so any rejected promise is forwarded
 * to Express's error-handling middleware instead of crashing the process.
 *
 * Usage: router.get('/', asyncHandler(controllerFn))
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
