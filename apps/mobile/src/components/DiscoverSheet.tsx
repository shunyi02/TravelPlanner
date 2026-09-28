import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  alreadyPlanned,
  DISCOVER_CATEGORIES,
  distanceKm,
  fetchPlaceSuggestions,
  type DiscoverCategoryId,
  type PlaceSuggestion,
} from '@travel-planner/shared';
import { api, type TripDetail } from '../api';
import { radius, typeScale, useTheme, type ThemeColors } from '../theme';
import { Button } from './Button';
import { LocationSearchField } from './LocationSearchField';
import { Tappable } from './Tappable';

interface Area {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

function formatDay(day: string): string {
  return new Date(day + 'T00:00:00Z').toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/** Places to search around: the trip's destination and each hotel, so a
 *  multi-city trip gets every base one tap away. Mirrors web's DiscoverPanel. */
function tripAreas(trip: TripDetail): Area[] {
  const areas: Area[] = [];
  if (trip.destinationLat != null && trip.destinationLng != null) {
    areas.push({
      id: 'destination',
      label: trip.destinationName?.split(',')[0] || 'Destination',
      lat: trip.destinationLat,
      lng: trip.destinationLng,
    });
  }
  const seen = new Set<string>();
  for (const p of trip.places) {
    if (p.type !== 'HOTEL' || p.lat == null || p.lng == null || seen.has(p.name)) continue;
    seen.add(p.name);
    areas.push({ id: `hotel-${p.id}`, label: p.name, lat: p.lat, lng: p.lng });
  }
  return areas;
}

/** Today if the trip is under way, else its first day. */
function defaultDay(days: string[]): string {
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local
  return days.includes(today) ? today : (days[0] ?? '');
}

/** Sheet for finding well-known places near the trip's bases and adding them
 *  straight onto a day. The mobile counterpart of web's DiscoverPanel. */
export function DiscoverSheet({
  visible,
  tripId,
  trip,
  days,
  onAdded,
  onClose,
}: {
  visible: boolean;
  tripId: string;
  trip: TripDetail;
  /** The trip's days ("YYYY-MM-DD"); empty when the trip has no dates. */
  days: string[];
  onAdded: () => void;
  onClose: () => void;
}) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const [customAreas, setCustomAreas] = useState<Area[]>([]);
  const areas = [...tripAreas(trip), ...customAreas];
  const [areaId, setAreaId] = useState<string | null>(areas[0]?.id ?? null);
  const [searching, setSearching] = useState(areas.length === 0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<DiscoverCategoryId>('landmarks');
  const [results, setResults] = useState<PlaceSuggestion[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [reload, setReload] = useState(0);
  const [addDay, setAddDay] = useState(() => defaultDay(days));
  // Suggestion id -> the place it created, so its card can offer Undo.
  const [added, setAdded] = useState<Map<string, { placeId: string; day: string }>>(new Map());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const area = areas.find((a) => a.id === areaId) ?? null;

  // Trip dates can change while the sheet is closed.
  useEffect(() => {
    if (visible && !days.includes(addDay)) setAddDay(defaultDay(days));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, days.join()]);

  useEffect(() => {
    if (!visible || !area) return;
    let current = true;
    setStatus('loading');
    setResults(null);
    fetchPlaceSuggestions(area.lat, area.lng, category)
      .then((r) => {
        if (!current) return;
        setResults(r);
        setStatus('idle');
      })
      .catch(() => current && setStatus('error'));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, area?.lat, area?.lng, category, reload]);

  const handleAdd = async (s: PlaceSuggestion) => {
    setBusyId(s.id);
    setActionError(null);
    try {
      // Local noon keeps the stop on the chosen calendar day in any timezone
      // and slots it mid-day among that day's stops.
      const place = await api.addPlace(tripId, {
        type: 'STOP',
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        ...(addDay ? { visitDate: new Date(`${addDay}T12:00:00`).toISOString() } : {}),
      });
      setAdded((prev) => new Map(prev).set(s.id, { placeId: place.id, day: addDay }));
      onAdded();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Couldn't add ${s.name}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleUndo = async (s: PlaceSuggestion) => {
    const entry = added.get(s.id);
    if (!entry) return;
    setBusyId(s.id);
    setActionError(null);
    try {
      await api.deletePlace(tripId, entry.placeId);
      setAdded((prev) => {
        const next = new Map(prev);
        next.delete(s.id);
        return next;
      });
      onAdded();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Couldn't remove ${s.name}`);
    } finally {
      setBusyId(null);
    }
  };

  // Just-added places stay listed (with Undo) even though they're now "planned".
  const visibleResults = (results ?? []).filter((s) => added.has(s.id) || !alreadyPlanned(s, trip.places));
  const hiddenCount = (results?.length ?? 0) - visibleResults.length;
  const addLabel = (day: string) => (day ? `Add to ${formatDay(day)}` : 'Add to plan');
  const addedLabel = (day: string) => (day ? `Added to ${formatDay(day)}` : 'Added, no day yet');
  const categoryLabel = DISCOVER_CATEGORIES.find((c) => c.id === category)!.label.toLowerCase();

  const chip = (key: string, label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
        <View style={styles.head}>
          <Text style={styles.title} accessibilityRole="header">
            Discover places
          </Text>
          <Button label="Done" variant="text" onPress={onClose} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Near</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {areas.map((a) =>
              chip(a.id, a.label, a.id === areaId && !searching, () => {
                setAreaId(a.id);
                setSearching(false);
              }),
            )}
            {chip('elsewhere', 'Elsewhere…', searching, () => setSearching((v) => !v))}
          </ScrollView>
          {searching && (
            <View style={{ marginTop: 10 }}>
              <LocationSearchField
                query={query}
                onQueryChange={setQuery}
                onPick={(pick) => {
                  const id = `custom-${pick.lat.toFixed(4)},${pick.lng.toFixed(4)}`;
                  setCustomAreas((prev) =>
                    prev.some((a) => a.id === id)
                      ? prev
                      : // Label it as typed: the geocoder's names can be in the local script.
                        [...prev, { id, label: query.trim() || pick.name, lat: pick.lat, lng: pick.lng }],
                  );
                  setAreaId(id);
                  setSearching(false);
                  setQuery('');
                }}
                placeholder="Search a city or area…"
              />
            </View>
          )}

          <Text style={[styles.label, styles.labelGap]}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {DISCOVER_CATEGORIES.map((c) => chip(c.id, c.label, category === c.id, () => setCategory(c.id)))}
          </ScrollView>

          {days.length > 0 && (
            <>
              <Text style={[styles.label, styles.labelGap]}>Add to</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {days.map((d, i) => chip(d, `Day ${i + 1} · ${formatDay(d)}`, addDay === d, () => setAddDay(d)))}
                {chip('none', 'No day yet', addDay === '', () => setAddDay(''))}
              </ScrollView>
            </>
          )}

          <View style={styles.results} accessibilityLiveRegion="polite">
            {actionError && <Text style={styles.error}>{actionError}</Text>}

            {!area ? (
              <Text style={styles.empty}>Search for a city or area to see well-known places nearby.</Text>
            ) : status === 'loading' ? (
              <ResultSkeleton styles={styles} />
            ) : status === 'error' ? (
              <View>
                <Text style={styles.empty}>Couldn't reach Wikidata to load suggestions.</Text>
                <Button
                  label="Try again"
                  variant="secondary"
                  onPress={() => setReload((n) => n + 1)}
                  style={{ alignSelf: 'flex-start' }}
                />
              </View>
            ) : visibleResults.length === 0 ? (
              <Text style={styles.empty}>
                {hiddenCount > 0
                  ? 'Everything well-known here is already in your plan. Try another category.'
                  : `No well-known ${categoryLabel} near ${area.label}. Try another category or area.`}
              </Text>
            ) : (
              <>
                {visibleResults.map((s) => {
                  const done = added.get(s.id);
                  return (
                    <View key={s.id} style={[styles.card, done && styles.cardAdded]}>
                      {s.imageUrl ? (
                        // The photo opens its Commons page, which credits its author and licence.
                        <Tappable
                          onPress={() => s.imagePage && Linking.openURL(s.imagePage)}
                          accessibilityRole="link"
                          accessibilityLabel={`Photo of ${s.name}: author and licence`}
                        >
                          <Image source={{ uri: s.imageUrl }} style={styles.photo} resizeMode="cover" />
                        </Tappable>
                      ) : (
                        <View style={[styles.photo, styles.photoEmpty]}>
                          <Text style={styles.photoEmptyGlyph}>📍</Text>
                        </View>
                      )}
                      <View style={styles.cardBody}>
                        <Text style={styles.name} numberOfLines={2}>
                          {s.name}
                        </Text>
                        <Text style={styles.meta} numberOfLines={1}>
                          {s.kind} · {formatDistance(distanceKm(area.lat, area.lng, s.lat, s.lng))}
                        </Text>
                        <Tappable onPress={() => Linking.openURL(s.url)} accessibilityRole="link" hitSlop={6}>
                          <Text style={styles.link}>Wikipedia ↗</Text>
                        </Tappable>
                        <View style={styles.actions}>
                          {done ? (
                            <>
                              <Text style={styles.added}>✓ {addedLabel(done.day)}</Text>
                              <Button
                                label="Undo"
                                variant="text"
                                disabled={busyId === s.id}
                                onPress={() => handleUndo(s)}
                              />
                            </>
                          ) : (
                            <Button
                              label={busyId === s.id ? 'Adding…' : `+ ${addLabel(addDay)}`}
                              variant="secondary"
                              size="sm"
                              disabled={busyId === s.id}
                              onPress={() => handleAdd(s)}
                              accessibilityLabel={`${addLabel(addDay)}: ${s.name}`}
                            />
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
                {hiddenCount > 0 && (
                  <Text style={styles.note}>
                    {hiddenCount} {hiddenCount === 1 ? 'place is' : 'places are'} already in your plan and hidden.
                  </Text>
                )}
              </>
            )}
          </View>

          <Text style={styles.foot}>
            Places from{' '}
            <Text style={styles.footLink} onPress={() => Linking.openURL('https://www.wikidata.org')}>
              Wikidata
            </Text>
            , photos from{' '}
            <Text style={styles.footLink} onPress={() => Linking.openURL('https://commons.wikimedia.org')}>
              Wikimedia Commons
            </Text>
            . Tap a photo for its author and licence.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Card-shaped placeholders while Wikidata answers. */
function ResultSkeleton({ styles }: { styles: ReturnType<typeof createStyles> }) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View accessibilityLabel="Loading places">
      {[0, 1, 2, 3].map((i) => (
        <Animated.View key={i} style={[styles.card, { opacity: pulse }]}>
          <View style={[styles.photo, styles.skeletonBlock]} />
          <View style={[styles.cardBody, { gap: 8 }]}>
            <View style={[styles.skeletonLine, { width: '70%' }]} />
            <View style={[styles.skeletonLine, { width: '45%' }]} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sheet: { flex: 1, backgroundColor: colors.bg },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.rule,
    },
    title: { fontSize: typeScale.title2, fontWeight: '700', letterSpacing: -0.3, color: colors.ink },
    body: { padding: 20, paddingBottom: 32 },
    label: { fontSize: typeScale.footnote, fontWeight: '600', color: colors.inkSoft, marginBottom: 8 },
    labelGap: { marginTop: 18 },
    chipRow: { gap: 8, paddingRight: 20 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.rule,
    },
    chipSelected: { backgroundColor: colors.route, borderColor: colors.route },
    chipText: { fontSize: typeScale.footnote, fontWeight: '500', color: colors.ink },
    chipTextSelected: { color: colors.onRoute, fontWeight: '600' },
    results: { marginTop: 24, gap: 12 },
    error: { color: colors.owe, fontSize: typeScale.subhead },
    empty: { fontSize: typeScale.subhead, lineHeight: 21, color: colors.inkSoft, marginBottom: 12 },
    card: {
      flexDirection: 'row',
      gap: 12,
      padding: 12,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      marginBottom: 12,
    },
    cardAdded: { backgroundColor: colors.routeSoft },
    photo: { width: 88, height: 88, borderRadius: radius.sm, backgroundColor: colors.rule },
    photoEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.routeSoft },
    photoEmptyGlyph: { fontSize: 26 },
    cardBody: { flex: 1 },
    name: { fontSize: typeScale.subhead, fontWeight: '600', color: colors.ink },
    meta: { fontSize: typeScale.footnote, color: colors.inkSoft, marginTop: 2 },
    link: { fontSize: typeScale.footnote, fontWeight: '500', color: colors.route, marginTop: 4 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' },
    added: { fontSize: typeScale.footnote, fontWeight: '600', color: colors.route },
    note: { fontSize: typeScale.footnote, color: colors.inkSoft },
    foot: { fontSize: typeScale.caption, lineHeight: 17, color: colors.inkSoft, marginTop: 24 },
    footLink: { color: colors.route, textDecorationLine: 'underline' },
    skeletonBlock: { backgroundColor: colors.rule },
    skeletonLine: { height: 11, borderRadius: 4, backgroundColor: colors.rule },
  });
}
