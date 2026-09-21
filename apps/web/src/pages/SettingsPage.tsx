import { useState } from 'react';
import { applyTheme, DEFAULT_THEME_ID, THEME_STORAGE_KEY, THEMES } from '../themes';

export function SettingsPage() {
  const [selected, setSelected] = useState(
    () => localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME_ID,
  );

  const handleSelect = (id: string) => {
    applyTheme(id);
    localStorage.setItem(THEME_STORAGE_KEY, id);
    setSelected(id);
  };

  return (
    <div className="main main-centered">
      <h1 className="page-title">Settings</h1>

      <div style={{ marginTop: 24 }}>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--ink-soft)' }}>Theme colors</p>
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
                style={{ background: theme.vars['--bg'] }}
              >
                <span
                  className="theme-swatch-accent"
                  style={{ background: theme.vars['--route'] }}
                />
              </span>
              <span className="theme-swatch-name">{theme.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
