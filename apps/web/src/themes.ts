export interface Theme {
  id: string;
  name: string;
  vars: Record<string, string>;
}

export const THEMES: Theme[] = [
  {
    id: 'forest',
    name: 'Forest',
    vars: {
      '--bg': '#fbfaf7',
      '--surface': '#ffffff',
      '--ink': '#1f2a24',
      '--ink-soft': '#57635c',
      '--rule': '#ddd6c9',
      '--route': '#2b6e5e',
      '--route-soft': '#e4efec',
      '--ledger': '#a6791e',
      '--ledger-soft': '#f6efe0',
      '--owe': '#9c4a3c',
      '--owe-soft': '#f5e8e5',
      '--hero': '#11302a',
      '--highlight': '#ecb34f',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    vars: {
      '--bg': '#f7fafc',
      '--surface': '#ffffff',
      '--ink': '#1b2733',
      '--ink-soft': '#54626f',
      '--rule': '#d7e1e8',
      '--route': '#2064a6',
      '--route-soft': '#e3edf6',
      '--ledger': '#9c7a1e',
      '--ledger-soft': '#f5eede',
      '--owe': '#a4433a',
      '--owe-soft': '#f5e6e4',
      '--hero': '#12283d',
      '--highlight': '#ecb34f',
    },
  },
  {
    id: 'plum',
    name: 'Plum',
    vars: {
      '--bg': '#faf8fb',
      '--surface': '#ffffff',
      '--ink': '#291f2e',
      '--ink-soft': '#645868',
      '--rule': '#e0d4e3',
      '--route': '#6d3f8f',
      '--route-soft': '#ede2f2',
      '--ledger': '#a1791e',
      '--ledger-soft': '#f5efe0',
      '--owe': '#a23f4e',
      '--owe-soft': '#f5e3e6',
      '--hero': '#281a33',
      '--highlight': '#e9b457',
    },
  },
  {
    id: 'clay',
    name: 'Clay',
    vars: {
      '--bg': '#fdf8f4',
      '--surface': '#ffffff',
      '--ink': '#2c2320',
      '--ink-soft': '#6b5c55',
      '--rule': '#ead9cd',
      '--route': '#b1552e',
      '--route-soft': '#f5e5da',
      '--ledger': '#8c7a1e',
      '--ledger-soft': '#f0eddb',
      '--owe': '#9c3c3c',
      '--owe-soft': '#f4e0e0',
      '--hero': '#35211a',
      '--highlight': '#e9b457',
    },
  },
];

export const DEFAULT_THEME_ID = 'forest';
export const THEME_STORAGE_KEY = 'theme';

export function applyTheme(id: string) {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
  for (const [key, value] of Object.entries(theme.vars)) {
    document.documentElement.style.setProperty(key, value);
  }
}
