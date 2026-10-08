import billingService from '../../modules/billing/billing.service.js';
import ApiError from '../../utils/ApiError.js';
import {
  USAGE_RESOURCE,
  USAGE_RESOURCE_VALUES,
  USAGE_LIMIT_MESSAGE,
} from '../../modules/billing/billing.constants.js';

/**
 * checkUsageLimit(resource)
 *
 * Parameterised gate that blocks an action when the tenant has reached its
 * plan's limit for `resource` (one of USAGE_RESOURCE). Mount it on the
 * mutating route whose resource it caps, e.g.:
 *
 *   contactRouter.post('/', checkUsageLimit(USAGE_RESOURCE.CONTACT), validate, ...)
 *   campaignRouter.post('/', checkUsageLimit(USAGE_RESOURCE.CAMPAIGN), validate, ...)
 *   messageRouter.post('/send-campaign/:id', checkUsageLimit(USAGE_RESOURCE.MESSAGE), ...)
 *
 * It resolves the tenant's effective plan (reusing req.billing if a prior
 * checkSubscription already attached it, otherwise resolving on the fly), reads
 * the current usage for the resource, and:
 *   • allows the request when the limit is UNLIMITED (-1) or usage is below it;
 *   • rejects with 403 and a resource-specific message when the limit is met.
 *
 * On success it attaches the evaluated figures to req.usage so a handler can
 * surface remaining quota without re-querying.
 *
 * Must run AFTER `protect`.
 *
 * @param {string} resource A USAGE_RESOURCE value.
 */
const checkUsageLimit = (resource) => {
  if (!USAGE_RESOURCE_VALUES.includes(resource)) {
    // Misconfiguration surfaces at mount time, not at request time.
    throw new Error(
      `checkUsageLimit: unknown resource "${resource}". Expected one of: ${USAGE_RESOURCE_VALUES.join(', ')}`
    );
  }

  return async (req, res, next) => {
    try {
      // Reuse the effective plan resolved by a prior checkSubscription, if any.
      const result = await billingService.evaluateUsage(
        req.user.id,
        resource,
        req.billing || null
      );

      if (!result.allowed) {
        return next(
          new ApiError(403, USAGE_LIMIT_MESSAGE[resource], [
            {
              resource,
              used: result.used,
              limit: result.limit,
              plan: result.plan?.name,
            },
          ])
        );
      }

      req.usage = {
        resource,
        used: result.used,
        limit: result.limit,
        unlimited: result.unlimited,
        remaining: result.unlimited ? null : Math.max(result.limit - result.used, 0),
      };
      return next();
    } catch (err) {
      return next(err);
    }
  };
};

export { checkUsageLimit, USAGE_RESOURCE };
export default checkUsageLimit;
