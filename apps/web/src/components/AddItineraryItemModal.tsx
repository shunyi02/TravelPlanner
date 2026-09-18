import { useState } from 'react';
import { api, type PlaceType } from '../api';

export function AddItineraryItemModal({
  tripId,
  onClose,
  onCreated,
}: {
  tripId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [type, setType] = useState<PlaceType | null>(null);
  const [name, setName] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [departureAirport, setDepartureAirport] = useState('');
  const [arrivalAirport, setArrivalAirport] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!type || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.addPlace(tripId, {
        type,
        name: name.trim(),
        visitDate: visitDate || undefined,
        ...(type === 'FLIGHT' && {
          departureTime: departureTime || undefined,
          arrivalTime: arrivalTime || undefined,
          departureAirport: departureAirport || undefined,
          arrivalAirport: arrivalAirport || undefined,
        }),
        ...(type === 'HOTEL' && {
          checkIn: checkIn || undefined,
          checkOut: checkOut || undefined,
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add item');
    } finally {
      setSaving(false);
    }
  };

  if (!type) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2 className="page-title" style={{ fontSize: 20 }}>Add to itinerary</h2>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-outline" onClick={() => setType('STOP')}>Stop</button>
            <button className="btn btn-outline" onClick={() => setType('HOTEL')}>Hotel</button>
            <button className="btn btn-outline" onClick={() => setType('FLIGHT')}>Flight</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="page-title" style={{ fontSize: 20 }}>
          Add {type === 'STOP' ? 'stop' : type === 'HOTEL' ? 'hotel' : 'flight'}
        </h2>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />

          {type === 'STOP' && (
            <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
          )}

          {type === 'FLIGHT' && (
            <>
              <input placeholder="Departure airport" value={departureAirport} onChange={(e) => setDepartureAirport(e.target.value)} />
              <input placeholder="Arrival airport" value={arrivalAirport} onChange={(e) => setArrivalAirport(e.target.value)} />
              <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                Departure
                <input type="datetime-local" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                Arrival
                <input type="datetime-local" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
              </label>
            </>
          )}

          {type === 'HOTEL' && (
            <>
              <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                Check-in
                <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                Check-out
                <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
              </label>
            </>
          )}

          {error && <p style={{ color: 'var(--owe)', margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-outline" onClick={() => setType(null)}>Back</button>
            <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}