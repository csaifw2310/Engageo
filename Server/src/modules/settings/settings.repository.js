import UserSettings from './settings.model.js';
import { DEFAULT_NOTIFICATIONS, DEFAULT_TIMEZONE } from './settings.constants.js';

/**
 * Settings data-access layer (Repository Pattern).
 *
 * This is the ONLY layer in the Settings module that touches MongoDB directly.
 * Services call repository methods; they never import the model. Every method
 * is tenant-scoped by `userId`, so no code path can read or mutate another
 * user's settings.
 *
 * Key design choices:
 *   • `findOrCreate` is the primary read path. It returns the existing document
 *     or creates one with defaults — callers never receive null.
 *   • Partial updates use dot-notation `$set` so a PATCH to one sub-section
 *     leaves the rest of the document untouched.
 *   • `lean()` is used for read-only fetches; the heavier hydrated Mongoose
 *     document is only returned from `findOrCreate` where write-after-read
 *     is sometimes needed.
 */
class SettingsRepository {
  // ── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * Build the default settings payload used when initialising a new document.
   * Returned as a plain object so it can be spread into findOneAndUpdate's
   * $setOnInsert stage.
   */
  #defaultDocument(userId) {
    return {
      userId,
      profile: {
        fullName: '',
        phoneNumber: '',
        avatarUrl: '',
      },
      business: {
        businessName: '',
        website: '',
        industry: '',
        address: '',
      },
      notifications: { ...DEFAULT_NOTIFICATIONS },
      preferences: {
        timezone: DEFAULT_TIMEZONE,
      },
    };
  }

  // ── Core CRUD ────────────────────────────────────────────────────────────────

  /**
   * Return the settings document for `userId`, auto-creating it with defaults
   * when it does not yet exist (upsert). The returned document is always a lean
   * plain object — callers never receive null.
   *
   * The `new: true` option returns the document AFTER the upsert so newly
   * created docs are immediately visible in the response.
   *
   * @param {string|ObjectId} userId
   * @returns {Promise<Object>} Lean UserSettings document.
   */
  async findOrCreate(userId) {
    return UserSettings.findOneAndUpdate(
      { userId },
      { $setOnInsert: this.#defaultDocument(userId) },
      { upsert: true, new: true, lean: true, setDefaultsOnInsert: true }
    );
  }

  /**
   * Perform a partial update using dot-notation field paths, returning the
   * updated lean document. Only the supplied fields are modified; all others
   * are left intact. An upsert is included as a safety net for cases where the
   * document was somehow never created.
   *
   * @param {string|ObjectId} userId
   * @param {Object} dotNotationUpdates  e.g. { 'profile.fullName': 'Alice' }
   * @returns {Promise<Object>} Updated lean UserSettings document.
   */
  async update(userId, dotNotationUpdates) {
    return UserSettings.findOneAndUpdate(
      { userId },
      { $set: dotNotationUpdates },
      { upsert: true, new: true, lean: true, setDefaultsOnInsert: true }
    );
  }

  // ── Section-level fetches (lean, index-backed) ────────────────────────────

  /**
   * Return only the `profile` sub-document for `userId`. Leans and projects
   * to avoid loading fields the caller does not need.
   *
   * @param {string|ObjectId} userId
   * @returns {Promise<Object|null>}
   */
  async findProfile(userId) {
    return UserSettings.findOne({ userId }, { profile: 1, _id: 0 }).lean();
  }

  /**
   * Return only the `business` sub-document.
   *
   * @param {string|ObjectId} userId
   * @returns {Promise<Object|null>}
   */
  async findBusiness(userId) {
    return UserSettings.findOne({ userId }, { business: 1, _id: 0 }).lean();
  }

  /**
   * Return only the `notifications` sub-document.
   *
   * @param {string|ObjectId} userId
   * @returns {Promise<Object|null>}
   */
  async findNotifications(userId) {
    return UserSettings.findOne({ userId }, { notifications: 1, _id: 0 }).lean();
  }

  /**
   * Return only the `preferences` sub-document.
   *
   * @param {string|ObjectId} userId
   * @returns {Promise<Object|null>}
   */
  async findPreferences(userId) {
    return UserSettings.findOne({ userId }, { preferences: 1, _id: 0 }).lean();
  }
}

export default new SettingsRepository();
