import Plan from './plan.model.js';
import { PLAN_NAMES } from '../billing.constants.js';

/**
 * Plan data-access layer (Repository Pattern).
 *
 * The ONLY place the Plan collection is touched. Services never import the
 * model directly. Plans are platform-wide, so — unlike the tenant-scoped
 * repositories elsewhere — these methods are not filtered by userId; access
 * control for the write methods is enforced one layer up by `authorize('admin')`
 * on the routes.
 */
class PlanRepository {
  /** All active plans, cheapest first (the public catalogue). */
  async findActive() {
    return Plan.find({ isActive: true })
      .sort({ priceMonthly: 1, name: 1 })
      .lean();
  }

  /** Every plan regardless of status (admin listing). */
  async findAll() {
    return Plan.find().sort({ priceMonthly: 1, name: 1 }).lean();
  }

  /** A single plan by id, or null. */
  async findById(id) {
    return Plan.findById(id).lean();
  }

  /**
   * A single plan document (NOT lean) by id, for callers that need instance
   * methods such as `priceFor()`. Returns null when not found.
   */
  async findDocById(id) {
    return Plan.findById(id);
  }

  /** Resolve a plan by its unique name (case-insensitive). */
  async findByName(name) {
    return Plan.findOne({ name }).collation({ locale: 'en', strength: 2 }).lean();
  }

  /** The Free plan document, or null when it has not been seeded. */
  async findFree() {
    return this.findByName(PLAN_NAMES.FREE);
  }

  async create(data) {
    return Plan.create(data);
  }

  /** Patch a plan and return the updated document (validators run). */
  async updateById(id, updates) {
    return Plan.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });
  }

  async deleteById(id) {
    return Plan.findByIdAndDelete(id);
  }
}

export default new PlanRepository();
