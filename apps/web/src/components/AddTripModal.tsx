import { useState } from 'react';
import { COMMON_CURRENCIES } from '@travel-planner/shared';
import { api } from '../api';

export function AddTripModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (tripId: string) => void;
}) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (file: File | null) => {
    if (!file) {
      setCoverPhoto(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCoverPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const trip = await api.createTrip({
        name: name.trim(),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        coverPhoto: coverPhoto || undefined,
        currency,
      });
      onCreated(trip.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create trip');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="page-title" style={{ fontSize: 22 }}>New trip</h2>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          {coverPhoto && (
            <img src={coverPhoto} alt="Cover preview" style={{ width: '100%', borderRadius: 6, maxHeight: 160, objectFit: 'cover' }} />
          )}
          <input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
          <input placeholder="Trip name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <span>to</span>
            <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
            Currency
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              style={{ display: 'block', marginTop: 4, width: '100%' }}
            >
              {COMMON_CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          {error && <p style={{ color: 'var(--owe)', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}