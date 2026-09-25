import { useState } from 'react';
import {
  APPEARANCE_STORAGE_KEY,
  applyTheme,
  storedAppearance,
  storedThemeId,
  THEME_STORAGE_KEY,
  THEMES,
  type Appearance,
} from '../themes';

const APPEARANCES: { id: Appearance; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode): the choice still applies for this visit.
  }
}

export function SettingsPage() {
  const [selected, setSelected] = useState(storedThemeId);
  const [appearance, setAppearance] = useState(storedAppearance);

  const handleSelect = (id: string) => {
    applyTheme(id, appearance);
    save(THEME_STORAGE_KEY, id);
    setSelected(id);
  };

  const handleAppearance = (next: Appearance) => {
    applyTheme(selected, next);
    save(APPEARANCE_STORAGE_KEY, next);
    setAppearance(next);
  };

  return (
    <div className="main main-centered">
      <h1 className="page-title">Settings</h1>

      <section className="settings-section">
        <p className="settings-label">Appearance</p>
        <div className="segmented-control" role="group" aria-label="Appearance">
          {APPEARANCES.map((a) => (
            <button
              key={a.id}
              type="button"
              className={appearance === a.id ? 'active' : ''}
              aria-pressed={appearance === a.id}
              onClick={() => handleAppearance(a.id)}
            >
              {a.label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <p className="settings-label">Theme colors</p>
        <div className="theme-swatch-grid">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={`theme-swatch${selected === theme.id ? ' selected' : ''}`}
              onClick={() => handleSelect(theme.id)}
              aria-pressed={selected === theme.id}
              title={theme.name}
            >
              <span
                className="theme-swatch-preview"
                style={{ background: theme.light['--bg'] }}
              >
                <span
                  className="theme-swatch-accent"
                  style={{ background: theme.light['--route'] }}
                />
              </span>
              <span className="theme-swatch-name">{theme.name}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
