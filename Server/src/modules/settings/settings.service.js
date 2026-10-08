import repository from './settings.repository.js';
import User from '../auth/auth.model.js';
import { DEFAULT_NOTIFICATIONS, DEFAULT_TIMEZONE, SETTINGS_MESSAGES } from './settings.constants.js';

/**
 * Settings service.
 *
 * Owns all business logic for the Settings module. It never touches MongoDB
 * directly — every persistence call is delegated to the repository. It:
 *
 *   • Auto-provisions a default settings document via `findOrCreate` so the
 *     caller never has to handle a missing document.
 *   • Translates flat PATCH payloads into dot-notation update objects, ensuring
 *     only explicitly supplied fields are written.
 *   • Guarantees tenant isolation: every method accepts `userId` as its first
 *     argument and passes it straight through to the repository, which
 *     always scopes queries to that user.
 *
 * NOTE on name sync: `UserSettings.profile.fullName` is the editable source
 * of truth for the user's display name (edited from the Settings page).
 * `User.name` is a denormalized copy used elsewhere in the app (navbar,
 * auth/me, etc.). Whenever `profile.fullName` changes, `updateProfile`
 * also writes through to `User.name` so both stay in sync.
 */
class SettingsService {
  // ── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * Convert a nested plain object into dot-notation key–value pairs suitable
   * for a MongoDB `$set`. Only the provided leaf values are included; missing
   * optional fields are never set to undefined/null, so partial updates work
   * as intended.
   *
   * Example:
   *   flattenToDot('profile', { fullName: 'Alice' })
   *   → { 'profile.fullName': 'Alice' }
   *
   * @param {string} prefix  Top-level sub-document key (e.g. 'profile').
   * @param {Object} obj     Fields to update (shallow — one level of nesting).
   * @returns {Object}       Dot-notation update map.
   */
  #flattenToDot(prefix, obj) {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      acc[`${prefix}.${key}`] = value;
      return acc;
    }, {});
  }

  // ── Complete settings ─────────────────────────────────────────────────────

  /**
   * Fetch (or auto-create) the full settings document for the user.
   *
   * @param {string} userId
   * @returns {Promise<Object>} Full lean UserSettings document.
   */
  async getSettings(userId) {
    return repository.findOrCreate(userId);
  }

  /**
   * Perform a top-level partial update: any combination of `profile`,
   * `business`, `notifications`, and `preferences` sub-sections may be
   * supplied. Only the provided fields within each sub-section are written.
   *
   * @param {string} userId
   * @param {Object} updates  Partial settings payload (validated upstream).
   * @returns {Promise<Object>} Updated full lean UserSettings document.
   */
  async updateSettings(userId, updates) {
    const dotUpdates = {};

    if (updates.profile) {
      Object.assign(dotUpdates, this.#flattenToDot('profile', updates.profile));
    }
    if (updates.business) {
      Object.assign(dotUpdates, this.#flattenToDot('business', updates.business));
    }
    if (updates.notifications) {
      Object.assign(dotUpdates, this.#flattenToDot('notifications', updates.notifications));
    }
    if (updates.preferences) {
      Object.assign(dotUpdates, this.#flattenToDot('preferences', updates.preferences));
    }

    const updated = await repository.update(userId, dotUpdates);

    // Same sync rule applies here: this endpoint can also update
    // profile.fullName (it's a superset of the section-level endpoints),
    // so keep User.name in sync from this path too.
    if (updates.profile?.fullName !== undefined) {
      await User.findByIdAndUpdate(userId, { name: updates.profile.fullName });
    }

    return updated;
  }

  // ── Profile ───────────────────────────────────────────────────────────────

  /**
   * Return the profile sub-document, auto-creating the settings document if
   * this is the user's first access.
   *
   * @param {string} userId
   * @returns {Promise<Object>} e.g. { fullName, phoneNumber, avatarUrl }
   */
  async getProfile(userId) {
    const doc = await repository.findProfile(userId);

    // Settings document not yet created — auto-provision then re-fetch.
    if (!doc) {
      const created = await repository.findOrCreate(userId);
      return created.profile;
    }

    return doc.profile;
  }

  /**
   * Update only the supplied profile fields.
   *
   * If `fullName` is part of the update, also writes through to
   * `User.name` so every part of the app that reads the user's name
   * (navbar, auth/me, etc.) reflects the change immediately — not just
   * the Settings page itself.
   *
   * @param {string} userId
   * @param {Object} data  Validated profile fields (fullName, phoneNumber, avatarUrl).
   * @returns {Promise<Object>} Updated profile sub-document.
   */
  async updateProfile(userId, data) {
    const dotUpdates = this.#flattenToDot('profile', data);
    const updated = await repository.update(userId, dotUpdates);

    // ✅ Keep User.name in sync whenever fullName is part of this update.
    if (data.fullName !== undefined) {
      await User.findByIdAndUpdate(userId, { name: data.fullName });
    }

    return updated.profile;
  }

  // ── Business information ──────────────────────────────────────────────────

  /**
   * Return the business sub-document, auto-creating the settings document if
   * needed.
   *
   * @param {string} userId
   * @returns {Promise<Object>} e.g. { businessName, website, industry, address }
   */
  async getBusiness(userId) {
    const doc = await repository.findBusiness(userId);

    if (!doc) {
      const created = await repository.findOrCreate(userId);
      return created.business;
    }

    return doc.business;
  }

  /**
   * Update only the supplied business fields.
   *
   * @param {string} userId
   * @param {Object} data  Validated business fields.
   * @returns {Promise<Object>} Updated business sub-document.
   */
  async updateBusiness(userId, data) {
    const dotUpdates = this.#flattenToDot('business', data);
    const updated = await repository.update(userId, dotUpdates);
    return updated.business;
  }

  // ── Notification preferences ──────────────────────────────────────────────

  /**
   * Return the notifications sub-document, auto-creating the settings
   * document if needed.
   *
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async getNotifications(userId) {
    const doc = await repository.findNotifications(userId);

    if (!doc) {
      const created = await repository.findOrCreate(userId);
      return created.notifications;
    }

    return doc.notifications;
  }

  /**
   * Update only the supplied notification flags (other flags are unchanged).
   *
   * @param {string} userId
   * @param {Object} data  Validated notification boolean fields.
   * @returns {Promise<Object>} Updated notifications sub-document.
   */
  async updateNotifications(userId, data) {
    const dotUpdates = this.#flattenToDot('notifications', data);
    const updated = await repository.update(userId, dotUpdates);
    return updated.notifications;
  }

  // ── Preferences ───────────────────────────────────────────────────────────

  /**
   * Return the preferences sub-document (currently just `timezone`),
   * auto-creating the settings document if needed.
   *
   * @param {string} userId
   * @returns {Promise<Object>} e.g. { timezone: 'Asia/Kolkata' }
   */
  async getPreferences(userId) {
    const doc = await repository.findPreferences(userId);

    if (!doc) {
      const created = await repository.findOrCreate(userId);
      return created.preferences;
    }

    return doc.preferences;
  }

  /**
   * Update only the supplied preference fields.
   *
   * @param {string} userId
   * @param {Object} data  Validated preference fields (e.g. { timezone }).
   * @returns {Promise<Object>} Updated preferences sub-document.
   */
  async updatePreferences(userId, data) {
    const dotUpdates = this.#flattenToDot('preferences', data);
    const updated = await repository.update(userId, dotUpdates);
    return updated.preferences;
  }
}

export default new SettingsService();