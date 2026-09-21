import { useState } from 'react';
import { api, type Trip } from '../api';

interface Suggestion {
  id: number;
  name: string;
  lat: number;
  lng: number;
  category: string;
  imageUrl?: string;
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const SEARCH_RADIUS_M = 15_000;

/** Node tags this cares about, roughly in "most likely to be a famous
 *  landmark" order — no real popularity signal exists in free OSM data. */
const TOURISM_TAGS = ['attraction', 'museum', 'viewpoint', 'artwork'];

/**
 * Best-effort free image lookup for one OSM node — no key, no paid image
 * API. Prefers the node's `wikipedia` tag (fetches that Wikipedia article's
 * thumbnail via the public REST summary endpoint); falls back to a direct
 * `wikimedia_commons` file tag via Commons' Special:FilePath redirect.
 * Neither tag is guaranteed to exist, so most suggestions still end up
 * with no image — the card just shows a placeholder then.
 */
async function resolveImage(tags: Record<string, string>): Promise<string | undefined> {
  const wikipedia = tags.wikipedia;
  if (wikipedia) {
    const sep = wikipedia.indexOf(':');
    const lang = sep > 0 ? wikipedia.slice(0, sep) : 'en';
    const title = sep > 0 ? wikipedia.slice(sep + 1) : wikipedia;
    try {
      const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.thumbnail?.source) return data.thumbnail.source as string;
      }
    } catch {
      // fall through to the Commons tag, if any
    }
  }
  const commons = tags.wikimedia_commons;
  if (commons?.startsWith('File:')) {
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(commons.slice('File:'.length))}?width=300`;
  }
  return undefined;
}

async function fetchSuggestions(lat: number, lng: number): Promise<Suggestion[]> {
  const query = `[out:json][timeout:25];(node["tourism"~"^(${TOURISM_TAGS.join('|')})$"](around:${SEARCH_RADIUS_M},${lat},${lng}););out body 30;`;
  const res = await fetch(OVERPASS_URL, { method: 'POST', body: `data=${encodeURIComponent(query)}` });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = await res.json();
  const elements: Array<{ id: number; lat: number; lon: number; tags?: Record<string, string> }> = data.elements ?? [];

  return Promise.all(
    elements
      .filter((el) => el.tags?.name)
      .map(async (el) => ({
        id: el.id,
        name: el.tags!.name,
        lat: el.lat,
        lng: el.lon,
        category: el.tags!.tourism ?? 'attraction',
        imageUrl: await resolveImage(el.tags!),
      })),
  );
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
        <>
          {suggestions.length === 0 ? (
            <p className="empty-state" style={{ padding: '8px 0' }}>
              No new suggestions found near {trip.destinationName ?? 'this destination'}.
            </p>
          ) : (
            <div className="suggested-stops-grid">
              {suggestions.map((s) => (
                <div className="suggested-stop-card" key={s.id}>
                  {s.imageUrl ? (
                    <img className="suggested-stop-image" src={s.imageUrl} alt="" loading="lazy" />
                  ) : (
                    <div className="suggested-stop-image suggested-stop-image-placeholder">📍</div>
                  )}
                  <div className="suggested-stop-body">
                    <span className="suggested-stop-name" title={s.name}>{s.name}</span>
                    <span className="suggested-stop-category">{s.category}</span>
                    <button
                      type="button"
                      className="btn btn-outline suggested-stop-add"
                      disabled={addedIds.has(s.id)}
                      onClick={() => handleAdd(s)}
                    >
                      {addedIds.has(s.id) ? 'Added' : '+ Add'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
