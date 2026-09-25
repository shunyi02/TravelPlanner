export interface Theme {
  id: string;
  name: string;
  light: Record<string, string>;
  dark: Record<string, string>;
}

/** Light-or-dark preference from Settings; 'system' follows the OS. */
export type Appearance = 'system' | 'light' | 'dark';

/** Dark-mode canvas shared by every theme; each theme keeps its own accents. */
const DARK_NEUTRALS = {
  '--bg': '#121214',
  '--surface': '#1c1c1f',
  '--ink': '#f2f2f5',
  '--ink-soft': '#a1a1a8',
  '--rule': '#2e2e33',
};

/** Single source for every theme's color tokens, applied at startup (main.tsx)
 *  and from Settings. Forest's light set mirrors base.css's :root defaults.
 *  In both modes each --route, --ledger and --owe clears 4.5:1 (WCAG AA) as
 *  text on --surface, --bg and its own -soft tint, and against the button
 *  label color (--on-route, base.css). */
export const THEMES: Theme[] = [
  {
    id: 'forest',
    name: 'Forest',
    light: {
      '--bg': '#f2f2f7',
      '--surface': '#ffffff',
      '--ink': '#1d1d1f',
      '--ink-soft': '#6e6e73',
      '--rule': '#e5e5ea',
      '--route': '#177b4a',
      '--route-soft': '#e3f6ec',
      '--ledger': '#9a5e17',
      '--ledger-soft': '#fbf0df',
      '--owe': '#c82d20',
      '--owe-soft': '#fceae8',
      '--hero': '#11302a',
      '--highlight': '#ecb34f',
    },
    dark: {
      ...DARK_NEUTRALS,
      '--route': '#22b76e',
      '--route-soft': '#1d3b2f',
      '--ledger': '#df8c29',
      '--ledger-soft': '#433221',
      '--owe': '#ea8279',
      '--owe-soft': '#453031',
      '--hero': '#11302a',
      '--highlight': '#ecb34f',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    light: {
      '--bg': '#f2f5f8',
      '--surface': '#ffffff',
      '--ink': '#1c1e21',
      '--ink-soft': '#667080',
      '--rule': '#e1e7ed',
      '--route': '#0068d1',
      '--route-soft': '#e3f0ff',
      '--ledger': '#9a5e17',
      '--ledger-soft': '#fbf0df',
      '--owe': '#c82d20',
      '--owe-soft': '#fceae8',
      '--hero': '#12283d',
      '--highlight': '#ecb34f',
    },
    dark: {
      ...DARK_NEUTRALS,
      '--route': '#63a5e9',
      '--route-soft': '#2a3747',
      '--ledger': '#df8c29',
      '--ledger-soft': '#433221',
      '--owe': '#ea8279',
      '--owe-soft': '#453031',
      '--hero': '#12283d',
      '--highlight': '#ecb34f',
    },
  },
  {
    id: 'plum',
    name: 'Plum',
    light: {
      '--bg': '#f6f2f8',
      '--surface': '#ffffff',
      '--ink': '#201c23',
      '--ink-soft': '#756b7c',
      '--rule': '#e6deea',
      '--route': '#9d2bd7',
      '--route-soft': '#f3e5fb',
      '--ledger': '#9a5e17',
      '--ledger-soft': '#fbf0df',
      '--owe': '#c82d20',
      '--owe-soft': '#fceae8',
      '--hero': '#281a33',
      '--highlight': '#e9b457',
    },
    dark: {
      ...DARK_NEUTRALS,
      '--route': '#c887e8',
      '--route-soft': '#3e3147',
      '--ledger': '#df8c29',
      '--ledger-soft': '#433221',
      '--owe': '#ea8279',
      '--owe-soft': '#453031',
      '--hero': '#281a33',
      '--highlight': '#e9b457',
    },
  },
  {
    id: 'clay',
    name: 'Clay',
    light: {
      '--bg': '#f8f3ef',
      '--surface': '#ffffff',
      '--ink': '#241e1a',
      '--ink-soft': '#7a6d63',
      '--rule': '#ece0d6',
      '--route': '#b7410d',
      '--route-soft': '#fbe7dc',
      '--ledger': '#8a6617',
      '--ledger-soft': '#f8efdc',
      '--owe': '#b93838',
      '--owe-soft': '#f7e3e1',
      '--hero': '#35211a',
      '--highlight': '#e9b457',
    },
    dark: {
      ...DARK_NEUTRALS,
      '--route': '#e8875c',
      '--route-soft': '#45312b',
      '--ledger': '#cc9622',
      '--ledger-soft': '#3f3420',
      '--owe': '#dc8b8b',
      '--owe-soft': '#423235',
      '--hero': '#35211a',
      '--highlight': '#e9b457',
    },
  },
];

export const DEFAULT_THEME_ID = 'forest';
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
