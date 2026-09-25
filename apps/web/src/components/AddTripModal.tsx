import { useState } from 'react';
import { COMMON_CURRENCIES } from '@travel-planner/shared';
import { api } from '../api';
import { LocationSearchField } from './LocationSearchField';

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
  const [destinationQuery, setDestinationQuery] = useState('');
  const [destinationName, setDestinationName] = useState<string | undefined>();
  const [destinationLat, setDestinationLat] = useState<number | undefined>();
  const [destinationLng, setDestinationLng] = useState<number | undefined>();
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
        destinationName,
        destinationLat,
        destinationLng,
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
        <h2 className="modal-title">New trip</h2>
        <form onSubmit={handleSave} className="form-stack">
          <div className="avatar-row">
            <span className="profile-avatar-preview cover-preview">
              {coverPhoto && <img src={coverPhoto} alt="" />}
            </span>
            <label className="btn btn-outline">
              {coverPhoto ? 'Change cover photo' : 'Add cover photo'}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                hidden
              />
            </label>
          </div>

          <label className="field">
            Trip name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </label>

          <label className="field">
            Destination (optional)
            <div>
              <LocationSearchField
                query={destinationQuery}
                onQueryChange={(q) => {
                  setDestinationQuery(q);
                  setDestinationName(undefined);
                  setDestinationLat(undefined);
                  setDestinationLng(undefined);
                }}
                onPick={(result) => {
                  setDestinationQuery(result.displayName);
                  setDestinationName(result.name);
                  setDestinationLat(result.lat);
                  setDestinationLng(result.lng);
                }}
                lat={destinationLat}
                lng={destinationLng}
                placeholder="Search a city…"
                showMap={false}
              />
            </div>
          </label>

          <label className="field">
            Dates
            <div className="date-range">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <span>to</span>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </label>

          <label className="field">
            Currency
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {COMMON_CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}