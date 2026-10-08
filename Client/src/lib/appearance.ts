import { useCallback, useEffect, useState } from "react";

// Keys stay exactly as index.css expects them — [data-appearance="green"],
// "blue", "purple", "pink", "black", "premium", "aurora", "classic". Only
// the user-facing LABELS changed (Green -> Emerald, Blue -> Ocean, etc.) —
// see APPEARANCE_PRESETS in AppearanceSelector.tsx. Renaming these keys
// would silently break every `.inbox[data-appearance="…"]` rule in
// index.css, so the string values here must never change independently of
// that file.
export type AppearanceKey =
  | "classic"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "black"
  | "premium"
  | "aurora";

const STORAGE_KEY = "engageo-appearance";
const EVENT_NAME = "engageo-appearance-change";
const DEFAULT_APPEARANCE: AppearanceKey = "classic";

export function applyAppearance(appearance: AppearanceKey) {
  localStorage.setItem(STORAGE_KEY, appearance);
  // Same broadcast pattern as applyTheme() in theme.ts — lets every
  // mounted `.inbox` root (and anything else listening) pick up the
  // change immediately, including across tabs via the storage event
  // below.
  window.dispatchEvent(
    new CustomEvent<AppearanceKey>(EVENT_NAME, { detail: appearance }),
  );
}

export function getStoredAppearance(): AppearanceKey {
  return (
    (localStorage.getItem(STORAGE_KEY) as AppearanceKey) ?? DEFAULT_APPEARANCE
  );
}

/**
 * Single source of truth for chat appearance — mirrors useTheme() exactly.
 * Whichever component renders the `.inbox` root div must spread this
 * value onto `data-appearance`, right alongside the existing
 * `data-theme={theme}`:
 *
 *   const [theme] = useTheme();
 *   const [appearance] = useAppearance();
 *   <div className="inbox" data-theme={theme} data-appearance={appearance}>
 *
 * Once that attribute is present, every `.inbox[data-theme="dark"]
 * [data-appearance="…"]` block already defined in index.css takes over —
 * no further CSS changes needed.
 */
export function useAppearance() {
  const [appearance, setAppearanceState] = useState<AppearanceKey>(
    getStoredAppearance,
  );

  useEffect(() => {
    const onAppearanceEvent = (e: Event) => {
      const detail = (e as CustomEvent<AppearanceKey>).detail;
      if (detail) setAppearanceState(detail);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setAppearanceState(e.newValue as AppearanceKey);
      }
    };
    window.addEventListener(EVENT_NAME, onAppearanceEvent);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, onAppearanceEvent);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setAppearance = useCallback((a: AppearanceKey) => {
    applyAppearance(a);
    setAppearanceState(a);
  }, []);

  return [appearance, setAppearance] as const;
}