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

      <form onSubmit={handleSave} className="form-stack profile-form">
        <div className="avatar-row">
          <span className="profile-avatar-preview">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : initials(name || currentUser.name)}
          </span>
          <label className="btn btn-outline">
            Change photo
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              hidden
            />
          </label>
        </div>

        <label className="field">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <label className="field">
          Email
          <input
            value={currentUser.email}
            readOnly
            disabled
          />
        </label>

        {error && <p className="form-error">{error}</p>}
        {saved && !error && <p className="form-success">Saved.</p>}

        <div>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
