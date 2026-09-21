import { useState } from 'react';
import { applyTheme, DEFAULT_THEME_ID, THEME_STORAGE_KEY, THEMES } from '../themes';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState(
    () => localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME_ID,
  );

  const handleSelect = (id: string) => {
    applyTheme(id);
    localStorage.setItem(THEME_STORAGE_KEY, id);
    setSelected(id);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="page-title" style={{ fontSize: 22 }}>Settings</h2>

        <div style={{ marginTop: 16 }}>
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
