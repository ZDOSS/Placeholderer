// useTheme — read/write the active theme, persist to localStorage.
//
// The theme is applied by setting `data-theme` on <html>. The
// stylesheet (styles.css) uses that attribute to swap CSS variable
// values for light vs dark.
//
// Persisted in localStorage per the spec's browser persistence policy.

import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'placeholderer:theme';
const ATTR = 'data-theme';

function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  // Fall back to the OS preference.
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute(ATTR, theme);
}

export function useTheme(): {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
} {
  const [theme, setThemeState] = useState<Theme>(() => {
    const initial = readInitialTheme();
    applyTheme(initial);
    return initial;
  });

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage may be unavailable (private mode, etc) — ignore.
    }
  }, [theme]);

  return {
    theme,
    setTheme: setThemeState,
    toggle: () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')),
  };
}
