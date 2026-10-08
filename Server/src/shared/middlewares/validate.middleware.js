import { validationResult } from "express-validator";
import ApiError from "../../utils/ApiError.js";

/**
 * Collects results from express-validator chains and throws a 422 if any failed.
 * Place AFTER the validator array and BEFORE the controller:
 *   router.post('/', validatorChain, validate, controller)
 */
const validate = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array().map((e) => ({
    field: e.path || e.param,
    message: e.msg,
  }));

  return next(new ApiError(422, "Validation failed", errors));
};

export default validate;
