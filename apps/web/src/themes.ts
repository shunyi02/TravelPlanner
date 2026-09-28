import {
  DEFAULT_THEME_ID,
  THEME_DEFINITIONS,
  type Appearance,
  type ThemePalette,
} from '@travel-planner/shared';

export { DEFAULT_THEME_ID, type Appearance };

export interface Theme {
  id: string;
  name: string;
  light: Record<string, string>;
  dark: Record<string, string>;
}

/** `inkSoft` becomes `--ink-soft`. */
function cssVars(palette: ThemePalette): Record<string, string> {
  return Object.fromEntries(
    Object.entries(palette).map(([key, value]) => [`--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, value]),
  );
}

/** Every theme's color tokens as CSS custom properties, applied at startup
 *  (main.tsx) and from Settings. The palette itself lives in the shared
 *  package so mobile uses the same colors; Forest's light set mirrors
 *  base.css's :root defaults. */
export const THEMES: Theme[] = THEME_DEFINITIONS.map((t) => ({
  id: t.id,
  name: t.name,
  light: cssVars(t.light),
  dark: cssVars(t.dark),
}));

export const THEME_STORAGE_KEY = 'theme';
export const APPEARANCE_STORAGE_KEY = 'appearance';

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The theme saved from Settings, or the default (storage can be unavailable). */
export function storedThemeId(): string {
  return readStorage(THEME_STORAGE_KEY) || DEFAULT_THEME_ID;
}

export function storedAppearance(): Appearance {
  const value = readStorage(APPEARANCE_STORAGE_KEY);
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function applyTheme(id: string, appearance: Appearance) {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
  const mode = appearance === 'system' ? (darkQuery.matches ? 'dark' : 'light') : appearance;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme[mode])) {
    root.style.setProperty(key, value);
  }
  // base.css keys its derived tokens (glass top bar, button label color) and
  // native control styling off this.
  root.dataset.mode = mode;
}

/** Apply the saved theme now and re-apply whenever the OS switches light/dark. */
export function initTheme() {
  const apply = () => applyTheme(storedThemeId(), storedAppearance());
  apply();
  darkQuery.addEventListener('change', apply);
}
