import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "dark" | "light";

const STORAGE_KEY = "engageo-theme";
const EVENT_NAME = "engageo-theme-change";

export function applyTheme(theme: ThemeMode) {
  if (theme === "light") {
    document.documentElement.classList.add("light-mode");
    document.documentElement.classList.remove("dark-mode");
  } else {
    document.documentElement.classList.remove("light-mode");
    document.documentElement.classList.add("dark-mode");
  }
  localStorage.setItem(STORAGE_KEY, theme);
  // Let every mounted component (even on other pages) know it changed
  window.dispatchEvent(new CustomEvent<ThemeMode>(EVENT_NAME, { detail: theme }));
}

export function getStoredTheme(): ThemeMode {
  return (localStorage.getItem(STORAGE_KEY) as ThemeMode) ?? "dark";
}

/** Single source of truth for theme — use this instead of local useState */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(getStoredTheme);

  useEffect(() => {
    const onThemeEvent = (e: Event) => {
      const detail = (e as CustomEvent<ThemeMode>).detail;
      if (detail) setThemeState(detail);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === "dark" || e.newValue === "light")) {
        setThemeState(e.newValue);
      }
    };
    window.addEventListener(EVENT_NAME, onThemeEvent);
    window.addEventListener("storage", onStorage); // syncs across tabs too
    return () => {
      window.removeEventListener(EVENT_NAME, onThemeEvent);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setTheme = useCallback((t: ThemeMode) => {
    applyTheme(t);
    setThemeState(t);
  }, []);

  return [theme, setTheme] as const;
}