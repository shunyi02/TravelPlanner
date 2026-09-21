import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../authContext';
import { initials } from '../format';

export function ProfilePage() {
  const { currentUser, setCurrentUser } = useAuth();
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // currentUser loads asynchronously (see AuthedApp's api.getMe() call), so
  // this page can mount before it's ready — sync the form once it arrives
  // rather than seeding state at first render, which would stay blank.
  useEffect(() => {
    if (currentUser && !initialized) {
      setName(currentUser.name);
      setAvatarUrl(currentUser.avatarUrl);
      setInitialized(true);
    }
  }, [currentUser, initialized]);

  const handleFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api.updateProfile({ name: name.trim(), avatarUrl: avatarUrl ?? undefined });
      setCurrentUser(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="main main-centered">
      <h1 className="page-title">Profile</h1>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24, maxWidth: 360 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="profile-avatar-preview">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : initials(name || currentUser.name)}
          </span>
          <label className="btn btn-outline" style={{ cursor: 'pointer' }}>
            Change photo
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ display: 'block', marginTop: 4, width: '100%' }}
          />
        </label>

        <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          Email
          <input
            value={currentUser.email}
            readOnly
            disabled
            style={{ display: 'block', marginTop: 4, width: '100%' }}
          />
        </label>

        {error && <p style={{ color: 'var(--owe)', margin: 0 }}>{error}</p>}
        {saved && !error && <p style={{ color: 'var(--route)', margin: 0 }}>Saved.</p>}

        <div>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
