/**
 * Pure, side-effect-free helpers for composing notification copy.
 * Kept separate from notification.events.js so the business-event wiring
 * stays readable and these are trivially unit-testable in isolation.
 */

/** Truncate a string to `max` chars, appending an ellipsis when cut. */
export const truncate = (value, max = 80) => {
  const str = String(value ?? "");
  return str.length > max ? `${str.slice(0, max)}…` : str;
};

/** Format a paise/rupee-style integer amount as a human-friendly ₹ string. */
/** Format a rupee amount as a human-friendly ₹ string. */
export const formatCurrency = (amount, currency = "INR") => {
  const value = Number(amount || 0);

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
};

/** "1 contact" vs "3 contacts". */
export const pluralize = (count, singular, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

/** Safely pull a display name off a campaign/plan/contact-like object. */
export const displayName = (entity, fallback = "Untitled") =>
  entity?.name || entity?.businessName || entity?.title || fallback;
