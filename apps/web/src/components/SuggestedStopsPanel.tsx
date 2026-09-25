import { MapPin } from '@phosphor-icons/react';
import { useState } from 'react';
import { api, type Trip } from '../api';
import { LocationSearchField } from './LocationSearchField';

interface Suggestion {
  id: string;
  name: string;
  lat: number;
  lng: number;
  description?: string;
  imageUrl?: string;
}

const SEARCH_RADIUS_KM = 10;
const RESULT_LIMIT = 60;

type CategoryId = 'landmarks' | 'leisure' | 'shopping' | 'city-walk';

/** Each category maps to its own Wikidata wdt:P31 types — the sitelink-count
 *  sort below is what keeps quality high within a category, not this list.
 *  "Landmarks" covers historical/scenic spots plus modern landmark shapes a
 *  monument-only list would miss (Shibuya Crossing is an "intersection",
 *  Shibuya Sky is an "observation deck", neither a monument or museum). */
const CATEGORIES: Array<{ id: CategoryId; label: string; types: string[] }> = [
  {
    id: 'landmarks',
    label: 'Landmarks',
    types: [
      'Q570116', // tourist attraction
      'Q174782', // town square
      'Q285783', // intersection
      'Q177305', // observation deck
      'Q2319498', // architectural landmark
    ],
  },
  {
    id: 'leisure',
    label: 'Leisure',
    types: [
      'Q22698', // park
      'Q1107656', // garden
      'Q167346', // botanical garden
      'Q40080', // beach
      'Q194195', // amusement park
      'Q43501', // zoo
    ],
  },
  {
    id: 'shopping',
    label: 'Shopping',
    types: [
      'Q11315', // shopping center
      'Q216107', // department store
      'Q21000333', // shopping street
      'Q27095213', // shopping district
      'Q330284', // marketplace
    ],
  },
  {
    id: 'city-walk',
    label: 'City walk',
    types: [
      'Q62685721', // pedestrian street
      'Q15243209', // historic district
      'Q174782', // town square
      'Q1962840', // night market
      'Q21000333', // shopping street (walkable arcades like Takeshita/Nakamise)
    ],
  },
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
async function fetchSuggestions(lat: number, lng: number, types: string[]): Promise<Suggestion[]> {
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
      VALUES ?type { ${types.map((q) => `wd:${q}`).join(' ')} }
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

/** Suggests well-known nearby places, addable to the itinerary with one
 *  click. Defaults to the trip's own destination, but the location field is
 *  editable — search anywhere (e.g. a side trip to Kamakura from a Tokyo
 *  trip) and suggestions run against that point instead. */
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
  const [searchQuery, setSearchQuery] = useState(trip.destinationName ?? '');
  const [searchLat, setSearchLat] = useState<number | undefined>(trip.destinationLat ?? undefined);
  const [searchLng, setSearchLng] = useState<number | undefined>(trip.destinationLng ?? undefined);
  const [category, setCategory] = useState<CategoryId>('landmarks');
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const existingLower = new Set(existingPlaceNames.map((n) => n.toLowerCase()));

  const handleSuggest = async () => {
    if (searchLat == null || searchLng == null) return;
    setLoading(true);
    setError(null);
    setSuggestions(null);
    setAddedIds(new Set());
    try {
      const types = CATEGORIES.find((c) => c.id === category)!.types;
      const results = await fetchSuggestions(searchLat, searchLng, types);
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
    <div className="no-print section-gap">
      <div className="suggested-stops-search">
        <LocationSearchField
          query={searchQuery}
          onQueryChange={(q) => {
            setSearchQuery(q);
            setSearchLat(undefined);
            setSearchLng(undefined);
          }}
          onPick={(result) => {
            setSearchQuery(result.displayName);
            setSearchLat(result.lat);
            setSearchLng(result.lng);
          }}
          lat={searchLat}
          lng={searchLng}
          placeholder="Search a place…"
          showMap={false}
        />
        <button
          type="button"
          className="btn btn-outline"
          onClick={handleSuggest}
          disabled={loading || searchLat == null || searchLng == null}
        >
          {loading ? 'Finding places…' : 'Suggest places to visit'}
        </button>
      </div>
      <div className="segmented-control suggested-stops-categories">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={category === c.id ? 'active' : ''}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      {error && <p className="form-error spaced-above">{error}</p>}
      {suggestions && (
        <>
          {suggestions.length === 0 ? (
            <p className="empty-state empty-state-compact">
              No new suggestions found near {searchQuery || 'this location'}.
            </p>
          ) : (
            <div className="suggested-stops-grid">
              {suggestions.map((s) => (
                <div className="suggested-stop-card" key={s.id}>
                  {s.imageUrl ? (
                    <img className="suggested-stop-image" src={s.imageUrl} alt="" loading="lazy" />
                  ) : (
                    <div className="suggested-stop-image suggested-stop-image-placeholder"><MapPin size={28} weight="duotone" aria-hidden /></div>
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
