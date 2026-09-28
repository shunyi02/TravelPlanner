/**
 * Color themes shared by web and mobile. Web writes each token as a CSS custom
 * property (`route` becomes `--route`); mobile reads the objects directly.
 *
 * In both modes each route, ledger and owe color clears 4.5:1 (WCAG AA) as text
 * on surface, bg and its own -soft tint, and against onRoute (the label color
 * on a solid route fill).
 */
export interface ThemePalette {
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

export interface ThemeDefinition {
  id: string;
  name: string;
  light: ThemePalette;
  dark: ThemePalette;
}

/** Light-or-dark preference from Settings; 'system' follows the OS. */
export type Appearance = 'system' | 'light' | 'dark';

/** Dark-mode canvas shared by every theme; each theme keeps its own accents. */
const DARK_NEUTRALS = {
  bg: '#121214',
  surface: '#1c1c1f',
  ink: '#f2f2f5',
  inkSoft: '#a1a1a8',
  rule: '#2e2e33',
};

export const THEME_DEFINITIONS: ThemeDefinition[] = [
  {
    id: 'forest',
    name: 'Forest',
    light: {
      bg: '#f2f2f7',
      surface: '#ffffff',
      ink: '#1d1d1f',
      inkSoft: '#6e6e73',
      rule: '#e5e5ea',
      route: '#177b4a',
      routeSoft: '#e3f6ec',
      ledger: '#9a5e17',
      ledgerSoft: '#fbf0df',
      owe: '#c82d20',
      oweSoft: '#fceae8',
      hero: '#11302a',
      highlight: '#ecb34f',
    },
    dark: {
      ...DARK_NEUTRALS,
      route: '#22b76e',
      routeSoft: '#1d3b2f',
      ledger: '#df8c29',
      ledgerSoft: '#433221',
      owe: '#ea8279',
      oweSoft: '#453031',
      hero: '#11302a',
      highlight: '#ecb34f',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    light: {
      bg: '#f2f5f8',
      surface: '#ffffff',
      ink: '#1c1e21',
      inkSoft: '#667080',
      rule: '#e1e7ed',
      route: '#0068d1',
      routeSoft: '#e3f0ff',
      ledger: '#9a5e17',
      ledgerSoft: '#fbf0df',
      owe: '#c82d20',
      oweSoft: '#fceae8',
      hero: '#12283d',
      highlight: '#ecb34f',
    },
    dark: {
      ...DARK_NEUTRALS,
      route: '#63a5e9',
      routeSoft: '#2a3747',
      ledger: '#df8c29',
      ledgerSoft: '#433221',
      owe: '#ea8279',
      oweSoft: '#453031',
      hero: '#12283d',
      highlight: '#ecb34f',
    },
  },
  {
    id: 'plum',
    name: 'Plum',
    light: {
      bg: '#f6f2f8',
      surface: '#ffffff',
      ink: '#201c23',
      inkSoft: '#756b7c',
      rule: '#e6deea',
      route: '#9d2bd7',
      routeSoft: '#f3e5fb',
      ledger: '#9a5e17',
      ledgerSoft: '#fbf0df',
      owe: '#c82d20',
      oweSoft: '#fceae8',
      hero: '#281a33',
      highlight: '#e9b457',
    },
    dark: {
      ...DARK_NEUTRALS,
      route: '#c887e8',
      routeSoft: '#3e3147',
      ledger: '#df8c29',
      ledgerSoft: '#433221',
      owe: '#ea8279',
      oweSoft: '#453031',
      hero: '#281a33',
      highlight: '#e9b457',
    },
  },
  {
    id: 'clay',
    name: 'Clay',
    light: {
      bg: '#f8f3ef',
      surface: '#ffffff',
      ink: '#241e1a',
      inkSoft: '#7a6d63',
      rule: '#ece0d6',
      route: '#b7410d',
      routeSoft: '#fbe7dc',
      ledger: '#8a6617',
      ledgerSoft: '#f8efdc',
      owe: '#b93838',
      oweSoft: '#f7e3e1',
      hero: '#35211a',
      highlight: '#e9b457',
    },
    dark: {
      ...DARK_NEUTRALS,
      route: '#e8875c',
      routeSoft: '#45312b',
      ledger: '#cc9622',
      ledgerSoft: '#3f3420',
      owe: '#dc8b8b',
      oweSoft: '#423235',
      hero: '#35211a',
      highlight: '#e9b457',
    },
  },
];

export const DEFAULT_THEME_ID = 'forest';

export function themeDefinitionById(id: string): ThemeDefinition {
  return THEME_DEFINITIONS.find((t) => t.id === id) ?? THEME_DEFINITIONS[0];
}
