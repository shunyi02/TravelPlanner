import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme, type ThemeColors } from '../theme';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export interface LocationPick {
  name: string;
  lat: number;
  lng: number;
  displayName: string;
}

/** Search-as-you-type place lookup (debounced Nominatim/OpenStreetMap — free,
 *  no API key, ~1req/s per their usage policy) with a dropdown of matches.
 *  `query`/`lat`/`lng` are controlled by the parent, which owns the picked
 *  location's final state (and clears lat/lng when the text changes after a
 *  pick — see the `onQueryChange` call site). Unlike the web version, this
 *  doesn't render a small preview map — the itinerary's route map already
 *  covers that once the place is saved. */
export function LocationSearchField({
  query,
  onQueryChange,
  onPick,
  lat,
  lng,
  placeholder = 'Search a place…',
}: {
  query: string;
  onQueryChange: (query: string) => void;
  onPick: (result: LocationPick) => void;
  lat?: number;
  lng?: number;
  placeholder?: string;
}) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched || query.trim().length < 3) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`,
        );
        const data: NominatimResult[] = await res.json();
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [query, touched]);

  const pick = (result: NominatimResult) => {
    setResults([]);
    setTouched(false);
    onPick({
      name: result.display_name.split(',')[0],
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      displayName: result.display_name,
    });
  };

  return (
    <View>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.inkSoft}
        value={query}
        onChangeText={(v) => {
          setTouched(true);
          onQueryChange(v);
        }}
      />
      {searching && <Text style={styles.hint}>Searching…</Text>}
      {results.map((r) => (
        <Pressable key={r.place_id} onPress={() => pick(r)} style={styles.resultRow}>
          <Text style={styles.resultText}>{r.display_name}</Text>
        </Pressable>
      ))}
      {lat !== undefined && lng !== undefined && (
        <Text style={[styles.hint, { color: colors.route }]}>
          📍 {lat.toFixed(5)}, {lng.toFixed(5)}
        </Text>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    input: {
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      color: colors.ink,
    },
    hint: { fontSize: 12, color: colors.inkSoft, marginTop: 4 },
    resultRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.rule },
    resultText: { fontSize: 13, color: colors.ink },
  });
}
