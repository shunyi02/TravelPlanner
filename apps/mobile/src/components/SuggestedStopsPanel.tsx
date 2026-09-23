import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, type Trip } from '../api';
import { LocationSearchField } from './LocationSearchField';
import { useTheme, type ThemeColors } from '../theme';

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
 *  sort below is what keeps quality high within a category, not this list. */
const CATEGORIES: Array<{ id: CategoryId; label: string; types: string[] }> = [
  {
    id: 'landmarks',
    label: 'Landmarks',
    types: ['Q570116', 'Q174782', 'Q285783', 'Q177305', 'Q2319498'],
  },
  {
    id: 'leisure',
    label: 'Leisure',
    types: ['Q22698', 'Q1107656', 'Q167346', 'Q40080', 'Q194195', 'Q43501'],
  },
  {
    id: 'shopping',
    label: 'Shopping',
    types: ['Q11315', 'Q216107', 'Q21000333', 'Q27095213', 'Q330284'],
  },
  {
    id: 'city-walk',
    label: 'City walk',
    types: ['Q62685721', 'Q15243209', 'Q174782', 'Q1962840', 'Q21000333'],
  },
];

/** "Famous nearby places" via a Wikidata SPARQL query (query.wikidata.org —
 *  free, no key, CORS-enabled), ranked by `wikibase:sitelinks` count (how
 *  many languages have an article on this exact entity) as a real, structured
 *  fame signal. Ported from the web app's SuggestedStopsPanel. */
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

/** Suggests well-known nearby places, addable to the itinerary with one tap.
 *  Defaults to the trip's own destination, but the location field is
 *  editable — search anywhere and suggestions run against that point instead. */
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
  const colors = useTheme();
  const styles = createStyles(colors);
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
    <View style={{ marginBottom: 20 }}>
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
      />
      <Pressable
        style={[styles.suggestButton, (loading || searchLat == null || searchLng == null) && { opacity: 0.5 }]}
        onPress={handleSuggest}
        disabled={loading || searchLat == null || searchLng == null}
      >
        <Text style={[styles.buttonText, { color: colors.route }]}>
          {loading ? 'Finding places…' : '✨ Suggest places to visit'}
        </Text>
      </Pressable>

      <View style={styles.categoryRow}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.id}
            style={[styles.categoryChip, category === c.id && styles.categoryChipActive]}
            onPress={() => setCategory(c.id)}
          >
            <Text style={[styles.categoryChipText, category === c.id && styles.categoryChipTextActive]}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {error && <Text style={{ color: colors.owe, marginTop: 8 }}>{error}</Text>}

      {suggestions &&
        (suggestions.length === 0 ? (
          <Text style={styles.empty}>No new suggestions found near {searchQuery || 'this location'}.</Text>
        ) : (
          <View style={styles.grid}>
            {suggestions.map((s) => (
              <View style={styles.card} key={s.id}>
                {s.imageUrl ? (
                  <Image source={{ uri: s.imageUrl }} style={styles.cardImage} />
                ) : (
                  <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                    <Text style={{ fontSize: 24 }}>📍</Text>
                  </View>
                )}
                <Text style={styles.cardName} numberOfLines={2}>
                  {s.name}
                </Text>
                {s.description ? <Text style={styles.cardCategory}>{s.description}</Text> : null}
                <Pressable
                  style={[styles.addButton, addedIds.has(s.id) && { opacity: 0.5 }]}
                  disabled={addedIds.has(s.id)}
                  onPress={() => handleAdd(s)}
                >
                  <Text style={[styles.buttonText, { color: colors.route }]}>
                    {addedIds.has(s.id) ? 'Added' : '+ Add'}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        ))}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    suggestButton: {
      borderWidth: 1,
      borderColor: colors.route,
      borderRadius: 6,
      paddingVertical: 10,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonText: { fontWeight: '600' },
    categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    categoryChip: {
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    categoryChipActive: { backgroundColor: colors.route, borderColor: colors.route },
    categoryChipText: { fontSize: 13, color: colors.ink },
    categoryChipTextActive: { color: '#fff' },
    empty: { color: colors.inkSoft, paddingVertical: 12 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
    card: {
      width: 150,
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: 8,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      paddingBottom: 8,
    },
    cardImage: { width: '100%', height: 90 },
    cardImagePlaceholder: {
      backgroundColor: colors.routeSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardName: { fontSize: 13, fontWeight: '600', color: colors.ink, marginTop: 6, paddingHorizontal: 8 },
    cardCategory: { fontSize: 11, color: colors.inkSoft, marginTop: 2, paddingHorizontal: 8 },
    addButton: { marginTop: 8, alignItems: 'center', paddingVertical: 4 },
  });
}
