import { useState } from 'react';
import { api, type Trip } from '../api';

interface Suggestion {
  id: string;
  name: string;
  lat: number;
  lng: number;
  description?: string;
  imageUrl?: string;
}

const SEARCH_RADIUS_KM = 10;
const RESULT_LIMIT = 40;

/** Wikidata types that plausibly mean "somewhere a tourist would go" — kept
 *  broad on purpose (the sitelink-count sort below is what actually keeps
 *  quality high, not this list). */
const ATTRACTION_TYPES = [
  'Q570116', // tourist attraction
  'Q4989906', // monument
  'Q33506', // museum
  'Q16560', // palace
  'Q16970', // church building
  'Q23413', // castle
  'Q839954', // archaeological site
  'Q174782', // town square
  'Q22698', // park
];

/**
 * "Famous nearby places" via a Wikidata SPARQL query (query.wikidata.org —
 * free, no key, CORS-enabled). History: first tried OSM/Overpass tourism
 * tags (caught anything tagged attraction/museum/etc regardless of size —
 * random fountains, a WWII bunker, no popularity signal at all). Then tried
 * plain Wikipedia geosearch (any nearby article with coordinates) — better,
 * but a big city has thousands of geotagged articles for streets, metro
 * stations, and office buildings, which buried real landmarks under purely-
 * closer noise.
 *
 * The fix: Wikidata's `wikibase:sitelinks` count — how many languages have
 * an article on this exact entity. A random square or parish church has a
 * handful at most; Notre-Dame or the Louvre has 100+. Sorting by that
 * (descending) is a real, structured fame signal instead of a guess, and it
 * degrades gracefully for a small destination with few notable entries —
 * there's no hard cutoff, just best-first.
 */
async function fetchSuggestions(lat: number, lng: number): Promise<Suggestion[]> {
  const point = `Point(${lng} ${lat})`;
  const query = `
    PREFIX wd: <http://www.wikidata.org/entity/>
    PREFIX wdt: <http://www.wikidata.org/prop/direct/>
    PREFIX bd: <http://www.bigdata.com/rdf#>
    PREFIX wikibase: <http://wikiba.se/ontology#>
    PREFIX geo: <http://www.opengis.net/ont/geosparql#>

    SELECT ?place ?placeLabel ?coord ?image ?typeLabel ?sitelinks WHERE {
      SERVICE wikibase:around {
        ?place wdt:P625 ?coord .
        bd:serviceParam wikibase:center "${point}"^^geo:wktLiteral .
        bd:serviceParam wikibase:radius "${SEARCH_RADIUS_KM}" .
      }
      ?place wdt:P31 ?type .
      VALUES ?type { ${ATTRACTION_TYPES.map((q) => `wd:${q}`).join(' ')} }
      ?place wikibase:sitelinks ?sitelinks .
      OPTIONAL { ?place wdt:P18 ?image }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    ORDER BY DESC(?sitelinks)
    LIMIT ${RESULT_LIMIT}
  `;
  const res = await fetch(`https://query.wikidata.org/sparql?${new URLSearchParams({ query, format: 'json' })}`, {
    headers: { Accept: 'application/sparql-results+json' },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = await res.json();
  const bindings: Array<{
    place: { value: string };
    placeLabel: { value: string };
    coord: { value: string };
    image?: { value: string };
    typeLabel?: { value: string };
  }> = data.results?.bindings ?? [];

  const byId = new Map<string, Suggestion>();
  for (const b of bindings) {
    const id = b.place.value.split('/').pop()!;
    // Raw QID as the label means no English (or fallback) name resolved —
    // not useful to show. A place can also appear once per P18 (image) it
    // has, so keep the first (highest-sitelinks) occurrence per id.
    if (byId.has(id) || /^Q\d+$/.test(b.placeLabel.value)) continue;
    const coordMatch = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.coord.value);
    if (!coordMatch) continue;
    byId.set(id, {
      id,
      name: b.placeLabel.value,
      lng: parseFloat(coordMatch[1]),
      lat: parseFloat(coordMatch[2]),
      description: b.typeLabel?.value,
      imageUrl: b.image ? `${b.image.value}?width=300` : undefined,
    });
  }
  return [...byId.values()];
}

/** Suggests well-known nearby places for a trip with a geocoded destination,
 *  addable to the itinerary with one click. */
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
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

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
                    {s.description && <span className="suggested-stop-category">{s.description}</span>}
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
