import billingService from '../../modules/billing/billing.service.js';
import ApiError from '../../utils/ApiError.js';
import { BILLING_MESSAGES } from '../../modules/billing/billing.constants.js';

/**
 * checkSubscription
 *
 * Gate that resolves the tenant's effective plan and attaches it to the request
 * for downstream handlers (notably checkUsageLimit). It is the billing module's
 * "is this tenant allowed in?" entry point.
 *
 * Behaviour:
 *   • Resolves the ACTIVE, non-expired subscription, or the Free tier when the
 *     tenant has no paid subscription. The Free tier is a valid access level, so
 *     a tenant on Free is NOT blocked here — billing is the source of truth for
 *     access, and that truth includes "everyone gets at least Free".
 *   • In strict mode (`checkSubscription({ requirePaid: true })`) a tenant on
 *     the implicit Free tier — i.e. with no active paid subscription — is
 *     rejected with 402. Use this to fence premium-only features.
 *
 * On success it sets:
 *   req.billing = { plan, subscription, isFree }
 * so a handler never has to re-resolve the plan it was just gated on.
 *
 * Must run AFTER `protect` (it relies on req.user.id).
 *
 * @param {object}  [options]
 * @param {boolean} [options.requirePaid=false] Reject tenants on the Free tier.
 */
const checkSubscription =
  ({ requirePaid = false } = {}) =>
  async (req, res, next) => {
    try {
      const effective = await billingService.resolveEffectivePlan(req.user.id);

      if (requirePaid && effective.isFree) {
        return next(new ApiError(402, BILLING_MESSAGES.NO_ACTIVE_SUBSCRIPTION));
      }

      req.billing = effective;
      return next();
    } catch (err) {
      return next(err);
    }
  };

export default checkSubscription;
