import repository from './plan.repository.js';
import ApiError from '../../../utils/ApiError.js';
import { BILLING_MESSAGES } from '../billing.constants.js';

/**
 * Plan service.
 *
 * Orchestrates the platform plan catalogue. Read methods are public (any
 * authenticated tenant lists/views active plans); write methods are reached
 * only through admin-guarded routes. No direct model access — everything goes
 * through the repository.
 */
class PlanService {
  /** Public catalogue: active plans only. */
  async listActivePlans() {
    return repository.findActive();
  }

  /** Admin listing: every plan regardless of status. */
  async listAllPlans() {
    return repository.findAll();
  }

  /** Fetch one plan (404 if missing). Used by both public and admin reads. */
  async getPlan(id) {
    const plan = await repository.findById(id);
    if (!plan) throw new ApiError(404, BILLING_MESSAGES.PLAN_NOT_FOUND);
    return plan;
  }

  /** Create a plan (admin). 409 on duplicate name. */
  async createPlan(data) {
    try {
      return await repository.create(data);
    } catch (err) {
      if (err && err.code === 11000) {
        throw new ApiError(409, BILLING_MESSAGES.PLAN_DUPLICATE_NAME);
      }
      throw err;
    }
  }

  /** Patch a plan (admin). 404 if missing, 409 on duplicate name. */
  async updatePlan(id, updates) {
    try {
      const plan = await repository.updateById(id, updates);
      if (!plan) throw new ApiError(404, BILLING_MESSAGES.PLAN_NOT_FOUND);
      return plan;
    } catch (err) {
      if (err && err.code === 11000) {
        throw new ApiError(409, BILLING_MESSAGES.PLAN_DUPLICATE_NAME);
      }
      throw err;
    }
  }

  /**
   * Delete a plan (admin). 404 if missing.
   *
   * NOTE: this is a hard delete of the catalogue entry. Existing subscriptions
   * keep their denormalised plan reference; deactivating (isActive=false) is the
   * recommended way to retire a plan from sale without disturbing live
   * subscriptions, and is what the admin UI should prefer.
   */
  async deletePlan(id) {
    const plan = await repository.deleteById(id);
    if (!plan) throw new ApiError(404, BILLING_MESSAGES.PLAN_NOT_FOUND);
    return plan;
  }
}

export default new PlanService();
