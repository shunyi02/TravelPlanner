import { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import {
  DEFAULT_THEME_ID,
  THEME_DEFINITIONS,
  themeDefinitionById,
  type Appearance,
  type ThemePalette,
} from '@travel-planner/shared';
import { storage } from './storage';

export type { Appearance };

export interface ThemeColors extends ThemePalette {
  /** Label color on a solid `route` fill. */
  onRoute: string;
  /** The hero hue as text on a surface: the hero itself in light mode, ink in dark mode. */
  heroText: string;
  /** Text on the dark hero banner, in every mode. */
  onHero: string;
  onHeroSoft: string;
}

export type ColorMode = 'light' | 'dark';

/** The palette (shared with web) plus the tokens web derives in base.css. */
function colorsFor(themeId: string, mode: ColorMode): ThemeColors {
  const palette = themeDefinitionById(themeId)[mode];
  return {
    ...palette,
    onRoute: mode === 'dark' ? '#121214' : '#ffffff',
    heroText: mode === 'dark' ? palette.ink : palette.hero,
    onHero: '#f6f0e1',
    onHeroSoft: 'rgba(246, 240, 225, 0.7)',
  };
}

/** Type scale, after iOS text styles. The system font everywhere, as on web: hierarchy comes from size and weight. */
export const typeScale = {
  caption: 12,
  footnote: 13,
  subhead: 15,
  body: 17,
  title2: 22,
  title1: 28,
  largeTitle: 34,
} as const;

/** Corner radii, matching web's --radius-* tokens. */
export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

const THEME_STORAGE_KEY = 'theme';
const APPEARANCE_STORAGE_KEY = 'appearance';

const ThemeContext = createContext<{
  themeId: string;
  setThemeId: (id: string) => void;
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
}>({
  themeId: DEFAULT_THEME_ID,
  setThemeId: () => {},
  appearance: 'system',
  setAppearance: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState(DEFAULT_THEME_ID);
  const [appearance, setAppearanceState] = useState<Appearance>('system');

  useEffect(() => {
    storage.getItemAsync(THEME_STORAGE_KEY).then((stored) => {
      if (stored) setThemeIdState(stored);
    });
    storage.getItemAsync(APPEARANCE_STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark') setAppearanceState(stored);
    });
  }, []);

  const setThemeId = (id: string) => {
    setThemeIdState(id);
    storage.setItemAsync(THEME_STORAGE_KEY, id).catch(() => {});
  };

  const setAppearance = (next: Appearance) => {
    setAppearanceState(next);
    storage.setItemAsync(APPEARANCE_STORAGE_KEY, next).catch(() => {});
  };

  return (
    <ThemeContext.Provider value={{ themeId, setThemeId, appearance, setAppearance }}>{children}</ThemeContext.Provider>
  );
}

/** Light or dark, from the Settings choice or else the OS. */
export function useColorMode(): ColorMode {
  const { appearance } = useContext(ThemeContext);
  const system = useColorScheme();
  if (appearance !== 'system') return appearance;
  return system === 'dark' ? 'dark' : 'light';
}

/** The active theme's colors in the active mode. */
export function useTheme(): ThemeColors {
  const { themeId } = useContext(ThemeContext);
  return colorsFor(themeId, useColorMode());
}

/** For the Settings screen only: the choices plus their setters. */
export function useThemeSetting() {
  const { themeId, setThemeId, appearance, setAppearance } = useContext(ThemeContext);
  return { themeId, setThemeId, appearance, setAppearance, themes: THEME_DEFINITIONS };
}
