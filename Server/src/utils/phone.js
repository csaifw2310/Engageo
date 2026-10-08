import { parsePhoneNumberFromString, isValidPhoneNumber } from "libphonenumber-js";

/**
 * Normalizes a phone number to E.164 and derives the WhatsApp wa_id format.
 *
 * Note: if `phone` already starts with "+", parsePhoneNumberFromString
 * ignores `defaultCountry` and parses using the embedded country code.
 * `defaultCountry` is only a fallback for numbers with no country code.
 *
 * @param {string} phone - raw phone input
 * @param {string} defaultCountry - ISO 3166 alpha-2 code, used only if no country code is present
 * @returns {
 *   { success: true, normalized: string, waId: string, national: string, international: string, country: string, type: string|undefined } |
 *   { success: false, error: "EMPTY_INPUT"|"PARSE_ERROR"|"UNPARSEABLE"|"INVALID_NUMBER" }
 * }
 */
export const normalizePhone = (phone, defaultCountry = "IN") => {
  if (!phone || typeof phone !== "string") {
    return { success: false, error: "EMPTY_INPUT" };
  }

  const trimmed = phone.trim();
  if (trimmed.length === 0) {
    return { success: false, error: "EMPTY_INPUT" };
  }

  let parsed;
  try {
    parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  } catch (err) {
    return { success: false, error: "PARSE_ERROR" };
  }

  if (!parsed) {
    return { success: false, error: "UNPARSEABLE" };
  }

  if (!parsed.isValid()) {
    return { success: false, error: "INVALID_NUMBER" };
  }

  return {
    success: true,
    normalized: parsed.number,                    // +919876543210 — canonical, store this
    waId: parsed.number.replace("+", ""),          // 919876543210 — use for WhatsApp API calls
    national: parsed.formatNational(),             // 98765 43210
    international: parsed.formatInternational(),   // +91 98765 43210
    country: parsed.country,                       // "IN"
    type: parsed.getType(),                         // "MOBILE" | "FIXED_LINE" | undefined
  };
};

/**
 * Quick boolean check, no parsing details needed.
 * @param {string} phone
 * @param {string} defaultCountry
 * @returns {boolean}
 */
export const isValidPhone = (phone, defaultCountry = "IN") =>
  isValidPhoneNumber(phone?.trim() || "", defaultCountry);