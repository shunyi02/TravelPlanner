import { useState } from 'react';
import type { Place } from '../api';
import { api } from '../api';

export function ItineraryTab({
  tripId,
  places,
  onChange,
}: {
  tripId: string;
  places: Place[];
  onChange: () => void;
}) {
  const [name, setName] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api.addPlace(tripId, { name: name.trim() });
    setName('');
    onChange();
  };

  return (
    <div>
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
