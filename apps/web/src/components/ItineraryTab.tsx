import { useState } from 'react';
import type { Place, TripDetail } from '../api';
import { api } from '../api';

export function ItineraryTab({
  tripId,
  trip,
  places,
  onChange,
}: {
  tripId: string;
  trip: TripDetail;
  places: Place[];
  onChange: () => void;
}) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(trip.startDate?.slice(0, 10) ?? '');
  const [endDate, setEndDate] = useState(trip.endDate?.slice(0, 10) ?? '');
  const [dateError, setDateError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api.addPlace(tripId, { name: name.trim() });
    setName('');
    onChange();
  };

  const handleSaveDates = async (e: React.FormEvent) => {
    e.preventDefault();
    setDateError(null);
    try {
      await api.updateTripDates(tripId, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      onChange();
    } catch (err) {
      setDateError(err instanceof Error ? err.message : 'Could not save dates');
    }
  };

  return (
    <div>
      <form className="form-inline" onSubmit={handleSaveDates} style={{ marginBottom: 24 }}>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <span>to</span>
        <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
        <button className="btn" type="submit">
          Save dates
        </button>
      </form>
      {dateError && <p style={{ color: 'var(--owe)', margin: '0 0 16px' }}>{dateError}</p>}

      {places.length === 0 ? (
        <p className="empty-state">No stops yet. Add the first place on your itinerary.</p>
      ) : (
        <div>
          {places.map((place, index) => (
            <div className="ledger-row" key={place.id}>
              <div className="row-main">
                <span className="stop-index">{index + 1}</span>
                <span className="row-title">{place.name}</span>
                {place.notes && <span className="row-sub">{place.notes}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      <form className="form-inline" onSubmit={handleAdd}>
        <input
          placeholder="Add a stop (e.g. Senso-ji Temple)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn" type="submit">
          Add stop
        </button>
      </form>
    </div>
  );
}