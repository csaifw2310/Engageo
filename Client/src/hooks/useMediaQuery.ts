import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query from React.
 *
 * Needed because some layouts are driven by inline styles (the inbox sets its
 * own `gridTemplateColumns`), and an inline style can never be overridden by a
 * class-based `@media` rule — JS has to own the decision.
 *
 * Prefer plain CSS/Tailwind breakpoints wherever the styling lives in a
 * stylesheet; reach for this only when the value must exist in JS.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);

    // Sync once on mount in case the query changed between render and effect.
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/* ── Shared inbox breakpoints ────────────────────────────────────────────
   Kept here (and mirrored in index.css) so the JS-driven grid and the
   CSS-driven show/hide rules can never disagree about where a layout
   switches.

   ≤ 760px  → single column: conversation list OR thread, never both
   ≤ 1080px → two columns: list + thread, contact panel becomes an overlay
─────────────────────────────────────────────────────────────────────────── */
export const INBOX_MOBILE_QUERY = "(max-width: 760px)";
export const INBOX_COMPACT_QUERY = "(max-width: 1080px)";

/** True below 760px — the inbox shows one pane at a time. */
export const useIsInboxMobile = () => useMediaQuery(INBOX_MOBILE_QUERY);

/** True below 1080px — the contact panel can't hold a static column. */
export const useIsInboxCompact = () => useMediaQuery(INBOX_COMPACT_QUERY);

export default useMediaQuery;