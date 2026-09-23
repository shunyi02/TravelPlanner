import { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { storage } from './storage';

export interface ThemeColors {
  bg: string;
  surface: string;
  ink: string;
  inkSoft: string;
  rule: string;
  route: string;
  routeSoft: string;
  ledger: string;
  ledgerSoft: string;
  owe: string;
  oweSoft: string;
  /** Dark banner background (trip hero). */
  hero: string;
  /** Warm highlight on the hero and for the selected day. */
  highlight: string;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
}

export const THEMES: Theme[] = [
  {
    id: 'forest',
    name: 'Forest',
    colors: {
      bg: '#fbfaf7',
      surface: '#ffffff',
      ink: '#1f2a24',
      inkSoft: '#57635c',
      rule: '#ddd6c9',
      route: '#2b6e5e',
      routeSoft: '#e4efec',
      ledger: '#a6791e',
      ledgerSoft: '#f6efe0',
      owe: '#9c4a3c',
      oweSoft: '#f5e8e5',
      hero: '#11302a',
      highlight: '#ecb34f',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: {
      bg: '#f7fafc',
      surface: '#ffffff',
      ink: '#1b2733',
      inkSoft: '#54626f',
      rule: '#d7e1e8',
      route: '#2064a6',
      routeSoft: '#e3edf6',
      ledger: '#9c7a1e',
      ledgerSoft: '#f5eede',
      owe: '#a4433a',
      oweSoft: '#f5e6e4',
      hero: '#12283d',
      highlight: '#ecb34f',
    },
  },
  {
    id: 'plum',
    name: 'Plum',
    colors: {
      bg: '#faf8fb',
      surface: '#ffffff',
      ink: '#291f2e',
      inkSoft: '#645868',
      rule: '#e0d4e3',
      route: '#6d3f8f',
      routeSoft: '#ede2f2',
      ledger: '#a1791e',
      ledgerSoft: '#f5efe0',
      owe: '#a23f4e',
      oweSoft: '#f5e3e6',
      hero: '#281a33',
      highlight: '#e9b457',
    },
  },
  {
    id: 'clay',
    name: 'Clay',
    colors: {
      bg: '#fdf8f4',
      surface: '#ffffff',
      ink: '#2c2320',
      inkSoft: '#6b5c55',
      rule: '#ead9cd',
      route: '#b1552e',
      routeSoft: '#f5e5da',
      ledger: '#8c7a1e',
      ledgerSoft: '#f0eddb',
      owe: '#9c3c3c',
      oweSoft: '#f4e0e0',
      hero: '#35211a',
      highlight: '#e9b457',
    },
  },
];

/** System fonts only — no font assets to load. */
export const fonts = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, Menlo, monospace' }),
};

export const DEFAULT_THEME_ID = 'forest';
const THEME_STORAGE_KEY = 'theme';

function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

const ThemeContext = createContext<{
  themeId: string;
  setThemeId: (id: string) => void;
}>({
  themeId: DEFAULT_THEME_ID,
  setThemeId: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState(DEFAULT_THEME_ID);

  useEffect(() => {
    storage.getItemAsync(THEME_STORAGE_KEY).then((stored) => {
      if (stored) setThemeIdState(stored);
    });
  }, []);

  const setThemeId = (id: string) => {
    setThemeIdState(id);
    storage.setItemAsync(THEME_STORAGE_KEY, id).catch(() => {});
  };

  return <ThemeContext.Provider value={{ themeId, setThemeId }}>{children}</ThemeContext.Provider>;
}

/** The active theme's colors — a drop-in replacement for the old static `colors` export. */
export function useTheme(): ThemeColors {
  const { themeId } = useContext(ThemeContext);
  return themeById(themeId).colors;
}

/** For the Settings screen only: the full theme list plus the setter. */
export function useThemeSetting(): { themeId: string; setThemeId: (id: string) => void; themes: Theme[] } {
  const { themeId, setThemeId } = useContext(ThemeContext);
  return { themeId, setThemeId, themes: THEMES };
}
