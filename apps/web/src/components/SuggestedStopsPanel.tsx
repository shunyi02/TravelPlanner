import { useState } from 'react';
import { api, type Trip } from '../api';

interface Suggestion {
  id: number;
  name: string;
  lat: number;
  lng: number;
  category: string;
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const SEARCH_RADIUS_M = 15_000;

/** Node tags this cares about, roughly in "most likely to be a famous
 *  landmark" order — no real popularity signal exists in free OSM data. */
const TOURISM_TAGS = ['attraction', 'museum', 'viewpoint', 'artwork'];

async function fetchSuggestions(lat: number, lng: number): Promise<Suggestion[]> {
  const query = `[out:json][timeout:25];(node["tourism"~"^(${TOURISM_TAGS.join('|')})$"](around:${SEARCH_RADIUS_M},${lat},${lng}););out body 30;`;
  const res = await fetch(OVERPASS_URL, { method: 'POST', body: `data=${encodeURIComponent(query)}` });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = await res.json();
  const elements: Array<{ id: number; lat: number; lon: number; tags?: Record<string, string> }> = data.elements ?? [];
  return elements
    .filter((el) => el.tags?.name)
    .map((el) => ({
      id: el.id,
      name: el.tags!.name,
      lat: el.lat,
      lng: el.lon,
      category: el.tags!.tourism ?? 'attraction',
    }));
}

/** Suggests well-known nearby places (OpenStreetMap Overpass API — free, no
 *  key) for a trip with a geocoded destination, addable to the itinerary
 *  with one click. No fame ranking exists in this free data — it's tag
 *  presence, not popularity — so coverage/order is best-effort. */
export function SuggestedStopsPanel({
  tripId,
  trip,
  existingPlaceNames,
  onAdded,
}: {
  tripId: string;
  trip: Trip;
  existingPlaceNames: string[];
  onAdded: () => void;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  if (trip.destinationLat == null || trip.destinationLng == null) {
    return (
      <p className="empty-state" style={{ padding: '8px 0' }}>
        Add a destination to this trip (from the create-trip form) to get place suggestions.
      </p>
    );
  }

  const existingLower = new Set(existingPlaceNames.map((n) => n.toLowerCase()));

  const handleSuggest = async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await fetchSuggestions(trip.destinationLat!, trip.destinationLng!);
      setSuggestions(results.filter((s) => !existingLower.has(s.name.toLowerCase())));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (s: Suggestion) => {
    try {
      await api.addPlace(tripId, { type: 'STOP', name: s.name, lat: s.lat, lng: s.lng });
      setAddedIds((prev) => new Set(prev).add(s.id));
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add stop');
    }
  };

  return (
    <div className="no-print" style={{ marginBottom: 20 }}>
      <button type="button" className="btn btn-outline" onClick={handleSuggest} disabled={loading}>
        {loading ? 'Finding places…' : '✨ Suggest places to visit'}
      </button>
      {error && <p style={{ color: 'var(--owe)', margin: '8px 0 0' }}>{error}</p>}
      {suggestions && (
        <ul className="suggested-stops-list">
          {suggestions.length === 0 ? (
            <li className="empty-state">No new suggestions found near {trip.destinationName ?? 'this destination'}.</li>
          ) : (
            suggestions.map((s) => (
              <li key={s.id} className="ledger-row">
                <div className="row-main">
                  <span className="row-title">{s.name}</span>
                  <span className="row-sub">{s.category}</span>
                </div>
                <button
                  type="button"
                  className="text-btn"
                  disabled={addedIds.has(s.id)}
                  onClick={() => handleAdd(s)}
                >
                  {addedIds.has(s.id) ? 'Added' : '+ Add'}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
