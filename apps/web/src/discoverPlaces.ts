/**
 * "Famous places nearby" for the Discover panel, via a Wikidata SPARQL query
 * (query.wikidata.org — free, no key, CORS-enabled).
 *
 * History: first tried OSM/Overpass tourism tags (caught anything tagged
 * attraction/museum/etc regardless of size — random fountains, a WWII bunker,
 * no popularity signal at all). Then plain Wikipedia geosearch (any nearby
 * article with coordinates) — better, but a big city has thousands of
 * geotagged articles for streets, metro stations and office buildings, which
 * buried real landmarks under purely-closer noise.
 *
 * The fix: Wikidata's `wikibase:sitelinks` count — how many languages have an
 * article on this exact entity. A random square or parish church has a
 * handful at most; Notre-Dame or the Louvre has 100+. Results are sorted by
 * it and thinned by a minimum (relaxed when a small place has few results).
 */

export interface Suggestion {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Friendly type label from our own category list, e.g. "Buddhist temple". */
  kind: string;
  imageUrl?: string;
  /** The photo's Commons file page, which credits its author and licence. */
  imagePage?: string;
  /** Opens the place's English Wikipedia article. */
  url: string;
  sitelinks: number;
}

export type CategoryId = 'landmarks' | 'nature' | 'museums' | 'shopping' | 'city-walk';

/** Each category maps to Wikidata wdt:P31 ("instance of") types. The
 *  sitelink sort is what keeps quality high within a category, not this list.
 *  Generic types like "intersection" are deliberately left out: they caught
 *  Shibuya Crossing but also every famous junction in a city, and the
 *  crossing is tagged "tourist attraction" as well. */
export const CATEGORIES: Array<{ id: CategoryId; label: string; types: Record<string, string> }> = [
  {
    id: 'landmarks',
    label: 'Landmarks',
    types: {
      Q570116: 'Tourist attraction',
      Q2319498: 'Landmark',
      Q177305: 'Observation deck',
      Q12518: 'Tower',
      Q23413: 'Castle',
      Q5393308: 'Buddhist temple',
      Q845945: 'Shinto shrine',
      Q44539: 'Temple',
      Q16970: 'Church',
      Q2977: 'Cathedral',
      Q32815: 'Mosque',
      Q174782: 'Town square',
    },
  },
  {
    id: 'nature',
    label: 'Nature',
    types: {
      Q22698: 'Park',
      Q1107656: 'Garden',
      Q167346: 'Botanical garden',
      Q40080: 'Beach',
      Q43501: 'Zoo',
      Q2281788: 'Aquarium',
      Q194195: 'Amusement park',
    },
  },
  {
    id: 'museums',
    label: 'Museums',
    types: {
      Q33506: 'Museum',
      Q207694: 'Art museum',
      Q16735822: 'History museum',
      Q588140: 'Science museum',
      Q17431399: 'National museum',
    },
  },
  {
    id: 'shopping',
    label: 'Shopping',
    types: {
      Q11315: 'Shopping centre',
      Q216107: 'Department store',
      Q21000333: 'Shopping street',
      Q27095213: 'Shopping district',
      Q330284: 'Market',
    },
  },
  {
    id: 'city-walk',
    label: 'City walk',
    types: {
      Q62685721: 'Pedestrian street',
      Q15243209: 'Historic district',
      Q1962840: 'Night market',
      Q174782: 'Town square',
      Q21000333: 'Shopping street',
    },
  },
];

const SEARCH_RADIUS_KM = 10;
const QUERY_LIMIT = 80;
const MIN_SITELINKS = 8;
const MIN_RESULTS = 6;
const MAX_RESULTS = 24;

/** Great-circle distance in km. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const cache = new Map<string, Promise<Suggestion[]>>();

/** Suggestions near a point for one category, best-known first. Cached for
 *  the session per point and category, so switching back is instant. */
export function fetchSuggestions(lat: number, lng: number, category: CategoryId): Promise<Suggestion[]> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)},${category}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = runQuery(lat, lng, category);
    // A failed request shouldn't stick: drop it so Retry asks again.
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return pending;
}

async function runQuery(lat: number, lng: number, category: CategoryId): Promise<Suggestion[]> {
  const types = CATEGORIES.find((c) => c.id === category)!.types;
  const query = `
    PREFIX wd: <http://www.wikidata.org/entity/>
    PREFIX wdt: <http://www.wikidata.org/prop/direct/>
    PREFIX bd: <http://www.bigdata.com/rdf#>
    PREFIX wikibase: <http://wikiba.se/ontology#>
    PREFIX geo: <http://www.opengis.net/ont/geosparql#>

    SELECT ?place ?placeLabel ?coord ?image ?type ?sitelinks WHERE {
      SERVICE wikibase:around {
        ?place wdt:P625 ?coord .
        bd:serviceParam wikibase:center "Point(${lng} ${lat})"^^geo:wktLiteral .
        bd:serviceParam wikibase:radius "${SEARCH_RADIUS_KM}" .
      }
      ?place wdt:P31 ?type .
      VALUES ?type { ${Object.keys(types).map((q) => `wd:${q}`).join(' ')} }
      ?place wikibase:sitelinks ?sitelinks .
      OPTIONAL { ?place wdt:P18 ?image }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    ORDER BY DESC(?sitelinks)
    LIMIT ${QUERY_LIMIT}
  `;
  const res = await fetch(`https://query.wikidata.org/sparql?${new URLSearchParams({ query, format: 'json' })}`, {
    headers: { Accept: 'application/sparql-results+json' },
  });
  if (!res.ok) throw new Error(`Wikidata returned ${res.status}`);
  const data = await res.json();
  const bindings: Array<Record<string, { value: string } | undefined>> = data.results?.bindings ?? [];

  const byId = new Map<string, Suggestion>();
  const seenNames = new Set<string>();
  for (const b of bindings) {
    const id = b.place!.value.split('/').pop()!;
    const name = b.placeLabel?.value ?? '';
    // A raw QID as the label means no English name resolved; a place also
    // repeats once per image/type, so keep its first (best) row. Distinct
    // entities can share a name too (two "St. Mary's Cathedral" items).
    if (byId.has(id) || /^Q\d+$/.test(name) || seenNames.has(name.toLowerCase())) continue;
    seenNames.add(name.toLowerCase());
    const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.coord?.value ?? '');
    if (!m) continue;
    const typeId = b.type?.value.split('/').pop() ?? '';
    byId.set(id, {
      id,
      name,
      lng: parseFloat(m[1]),
      lat: parseFloat(m[2]),
      kind: types[typeId] ?? 'Place',
      imageUrl: b.image ? `${b.image.value}?width=480` : undefined,
      imagePage: b.image ? b.image.value.replace(/^https?:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//, 'https://commons.wikimedia.org/wiki/File:') : undefined,
      // Redirects to the English Wikipedia article. Resolving the article in
      // the query itself roughly tripled its run time.
      url: `https://www.wikidata.org/wiki/Special:GoToLinkedPage/enwiki/${id}`,
      sitelinks: Number(b.sitelinks?.value ?? 0),
    });
  }

  const all = [...byId.values()];
  const famous = all.filter((s) => s.sitelinks >= MIN_SITELINKS);
  // A small town may have few famous entries: fall back to best-first.
  return (famous.length >= MIN_RESULTS ? famous : all).slice(0, MAX_RESULTS);
}

/** True when a suggestion is already in the plan: same name as any item, or
 *  within ~200 m of an existing stop (catches "Shibuya scramble crossing" vs a
 *  stop someone typed as "Shibuya Crossing"). */
export function alreadyPlanned(
  s: Suggestion,
  existing: Array<{ name: string; type: string; lat: number | null; lng: number | null }>,
): boolean {
  const name = s.name.toLowerCase();
  return existing.some(
    (p) =>
      p.name.toLowerCase() === name ||
      // Only stops count by distance: a hotel next to a landmark shouldn't hide it.
      (p.type === 'STOP' && p.lat != null && p.lng != null && distanceKm(s.lat, s.lng, p.lat, p.lng) < 0.2),
  );
}
