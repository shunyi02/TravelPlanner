import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Place, PlaceType, TripDetail } from '../api';
import { api } from '../api';
import { radius, typeScale, useTheme, type ThemeColors } from '../theme';
import { Button } from './Button';
import { useDialog } from './Dialog';
import { DayWeather } from './DayWeather';
import type { DayForecast } from '../weather';
import { fetchWeather } from '../weather';
import { RouteMap, type RouteStop } from './RouteMap';
import { DiscoverSheet } from './DiscoverSheet';
import { LocationSearchField } from './LocationSearchField';
import { AirportField } from './AirportField';
import { Tappable } from './Tappable';
import { DateField } from './DateField';
import { Field, TextField } from './Field';
import { Airplane, Bed, CalendarBlank, MapPin } from '../icons';

function daysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const cur = new Date(start + 'T00:00:00Z');
  const last = new Date(end + 'T00:00:00Z');
  while (cur <= last) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

/** "Sat, 12 Dec" for a day heading. */
function formatDayLong(iso: string) {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function formatTime(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Which day-buckets a place belongs in. Hotels span every day from checkIn to checkOut
 *  inclusive; flights/stops occupy a single day. */
function dayKeysFor(place: Place): string[] {
  if (place.type === 'HOTEL') {
    if (!place.checkIn) return [];
    const ci = place.checkIn.slice(0, 10);
    const co = place.checkOut ? place.checkOut.slice(0, 10) : ci;
    const keys: string[] = [];
    const cur = new Date(ci + 'T00:00:00Z');
    const last = new Date(co + 'T00:00:00Z');
    while (cur <= last) {
      keys.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return keys;
  }
  if (place.type === 'FLIGHT') {
    return place.departureTime ? [place.departureTime.slice(0, 10)] : [];
  }
  return place.visitDate ? [place.visitDate.slice(0, 10)] : [];
}

/** For a hotel shown under a specific day, label what's happening that day
 *  (check-in / staying / check-out). Undefined `day` means "not day-bucketed"
 *  (flat/unscheduled view) — falls back to date range. */
function hotelDayLabel(place: Place, day?: string): string | null {
  const ci = place.checkIn?.slice(0, 10);
  const co = place.checkOut?.slice(0, 10);
  if (!day || !ci) {
    return ci || co ? `${ci ?? ''}${co ? ` – ${co}` : ''}` : null;
  }
  if (day === ci && day === co) {
    return `Check-in ${formatTime(place.checkIn)} & check-out ${formatTime(place.checkOut)}`;
  }
  if (day === ci) return `Check-in ${formatTime(place.checkIn)}`;
  if (day === co) return `Check-out ${formatTime(place.checkOut)}`;
  return 'Staying';
}

function placeSubtitle(place: Place, day?: string): string | null {
  if (place.type === 'FLIGHT') {
    const from = place.departureAirport ?? '?';
    const to = place.arrivalAirport ?? '?';
    const dep = formatTime(place.departureTime);
    const arr = formatTime(place.arrivalTime);
    const times = dep && arr ? `${dep} – ${arr}` : dep ? `Departs ${dep}` : arr ? `Arrives ${arr}` : '';
    // Flights named after their route already say "SIN → NRT"; don't repeat it.
    const route = place.name === flightLabel(from, to) ? null : `${from} → ${to}`;
    return [route, times].filter(Boolean).join(' · ') || null;
  }
  if (place.type === 'HOTEL') {
    return hotelDayLabel(place, day);
  }
  const time = formatTime(place.visitDate);
  const parts = [time, place.notes].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Sort key for ordering rows within a single day bucket. Hotels use checkout
 *  time on their checkout day, check-in time otherwise (so "11am checkout" sits
 *  above "3pm check-in" on a same-day changeover). */
function sortTimeForDay(place: Place, day?: string): number {
  if (place.type === 'HOTEL') {
    const ci = place.checkIn;
    const co = place.checkOut;
    if (day && co && day === co.slice(0, 10) && (!ci || day !== ci.slice(0, 10))) {
      return new Date(co).getTime();
    }
    return ci ? new Date(ci).getTime() : 0;
  }
  if (place.type === 'FLIGHT') return place.departureTime ? new Date(place.departureTime).getTime() : 0;
  return place.visitDate ? new Date(place.visitDate).getTime() : 0;
}

/** Located stops/hotels from `list`, bucketed by day (each place's own first
 *  day key, "" if unscheduled) and colored one hue per day. Simplified from
 *  the web app's version: no per-traveler split-line sub-grouping, since
 *  mobile has no per-day tab to make that extra detail worth the complexity. */
function toRouteStops(list: Place[]): RouteStop[] {
  const located = list.filter((p): p is Place & { lat: number; lng: number } => p.lat != null && p.lng != null);

  const byDay = new Map<string, typeof located>();
  for (const p of located) {
    const d = dayKeysFor(p)[0] ?? '';
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(p);
  }

  const result: RouteStop[] = [];
  for (const [d, bucket] of byDay) {
    const sorted = [...bucket].sort((a, b) => sortTimeForDay(a, d) - sortTimeForDay(b, d));
    sorted.forEach((p, i) => {
      result.push({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, order: i + 1, colorGroup: d });
    });
  }
  return result;
}

/** ISO datetime -> "YYYY-MM-DD HH:mm" in local time, the value DateField works with. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "YYYY-MM-DD HH:mm" -> ISO, or undefined if blank. Throws on unparseable input. */
function parseLocalInput(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.replace(' ', 'T');
  const withSeconds = normalized.length === 16 ? `${normalized}:00` : normalized;
  const d = new Date(withSeconds);
  if (isNaN(d.getTime())) {
    throw new Error(`Couldn't read the date "${raw}". Pick it again.`);
  }
  return d.toISOString();
}

type PlaceInput = Parameters<typeof api.addPlace>[1];

/** Name for a flight the user left unnamed, e.g. "SIN → NRT". */
function flightLabel(from: string, to: string): string {
  return from || to ? `${from || '?'} → ${to || '?'}` : 'Flight';
}

const TYPE_OPTIONS: { type: PlaceType; label: string }[] = [
  { type: 'STOP', label: 'Stop' },
  { type: 'HOTEL', label: 'Hotel' },
  { type: 'FLIGHT', label: 'Flight' },
];

function TypeIcon({ type, color, size = 16 }: { type: PlaceType; color: string; size?: number }) {
  if (type === 'FLIGHT') return <Airplane size={size} color={color} weight="fill" />;
  if (type === 'HOTEL') return <Bed size={size} color={color} weight="fill" />;
  return <MapPin size={size} color={color} weight="fill" />;
}

/** Add/edit form for a single itinerary item, shown in a sheet. Used both for
 *  creating a new place (no `initial`) and editing an existing one (`initial`
 *  set, type switchable). */
function PlaceEditor({
  tripId,
  initial,
  defaultDay,
  onCancel,
  onSaved,
}: {
  tripId: string;
  initial?: Place;
  /** Where the date pickers open when a field is empty. */
  defaultDay?: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const [type, setType] = useState<PlaceType>(initial?.type ?? 'STOP');
  const [name, setName] = useState(initial?.name ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [visitDateTime, setVisitDateTime] = useState(initial?.visitDate ? toLocalInput(initial.visitDate) : '');
  const [departureAirport, setDepartureAirport] = useState(initial?.departureAirport ?? '');
  const [arrivalAirport, setArrivalAirport] = useState(initial?.arrivalAirport ?? '');
  const [departureDateTime, setDepartureDateTime] = useState(
    initial?.departureTime ? toLocalInput(initial.departureTime) : '',
  );
  const [arrivalDateTime, setArrivalDateTime] = useState(
    initial?.arrivalTime ? toLocalInput(initial.arrivalTime) : '',
  );
  const [checkInDateTime, setCheckInDateTime] = useState(initial?.checkIn ? toLocalInput(initial.checkIn) : '');
  const [checkOutDateTime, setCheckOutDateTime] = useState(initial?.checkOut ? toLocalInput(initial.checkOut) : '');
  const [locationQuery, setLocationQuery] = useState(initial?.type === 'STOP' ? initial.name : '');
  const [lat, setLat] = useState<number | undefined>(initial?.lat ?? undefined);
  const [lng, setLng] = useState<number | undefined>(initial?.lng ?? undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    // Flights name themselves from their airports; stops and hotels need a name.
    if (type !== 'FLIGHT' && !name.trim()) {
      setNameError(type === 'HOTEL' ? 'Enter the hotel name.' : 'Search for a place, or type its name.');
      return;
    }
    setNameError(null);
    setSaving(true);
    try {
      const payload: PlaceInput = {
        type,
        name: name.trim() || flightLabel(departureAirport.trim(), arrivalAirport.trim()),
      };
      if (type === 'STOP') {
        payload.visitDate = parseLocalInput(visitDateTime);
        payload.lat = lat;
        payload.lng = lng;
        payload.notes = notes.trim() || undefined;
      } else if (type === 'HOTEL') {
        payload.checkIn = parseLocalInput(checkInDateTime);
        payload.checkOut = parseLocalInput(checkOutDateTime);
      } else {
        payload.departureAirport = departureAirport.trim() || undefined;
        payload.arrivalAirport = arrivalAirport.trim() || undefined;
        payload.departureTime = parseLocalInput(departureDateTime);
        payload.arrivalTime = parseLocalInput(arrivalDateTime);
      }
      if (initial) {
        await api.updatePlace(tripId, initial.id, payload);
      } else {
        await api.addPlace(tripId, payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${initial ? 'save' : 'add'} this item`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHead}>
        <Button label="Cancel" variant="text" onPress={onCancel} />
        <Text style={styles.sheetTitle}>{initial ? 'Edit item' : 'Add to itinerary'}</Text>
        <Button label={saving ? 'Saving…' : initial ? 'Save' : 'Add'} variant="text" onPress={handleSave} disabled={saving} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.sheetBody, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.segmented} accessibilityRole="radiogroup" accessibilityLabel="Type">
          {TYPE_OPTIONS.map((o) => {
            const selected = type === o.type;
            return (
              <Tappable
                key={o.type}
                style={[styles.segment, selected && styles.segmentSelected]}
                onPress={() => setType(o.type)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
              >
                <TypeIcon type={o.type} color={selected ? colors.route : colors.inkSoft} />
                <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>{o.label}</Text>
              </Tappable>
            );
          })}
        </View>

        {type === 'STOP' && (
          <>
            <Field label="Place" error={nameError}>
              <LocationSearchField
                query={locationQuery}
                onQueryChange={(v) => {
                  setLocationQuery(v);
                  setName(v);
                  setLat(undefined);
                  setLng(undefined);
                }}
                onPick={(result) => {
                  setName(result.name);
                  setLat(result.lat);
                  setLng(result.lng);
                  setLocationQuery(result.displayName);
                }}
                lat={lat}
                lng={lng}
                placeholder="Search a place…"
              />
            </Field>
            <DateField
              label="When"
              mode="datetime"
              value={visitDateTime}
              onChange={setVisitDateTime}
              defaultDay={defaultDay}
              optional
              hint="Leave empty to keep it unscheduled."
            />
            <TextField label="Notes" placeholder="Optional" value={notes} onChangeText={setNotes} multiline />
          </>
        )}

        {type === 'HOTEL' && (
          <>
            <TextField label="Hotel" value={name} onChangeText={setName} error={nameError} />
            <DateField
              label="Check-in"
              mode="datetime"
              value={checkInDateTime}
              onChange={setCheckInDateTime}
              defaultDay={defaultDay}
              optional
            />
            <DateField
              label="Check-out"
              mode="datetime"
              value={checkOutDateTime}
              onChange={setCheckOutDateTime}
              defaultDay={checkInDateTime.slice(0, 10) || defaultDay}
              optional
            />
          </>
        )}

        {type === 'FLIGHT' && (
          <>
            <Field label="From">
              <AirportField value={departureAirport} onChange={setDepartureAirport} placeholder="City or airport code" />
            </Field>
            <Field label="To">
              <AirportField value={arrivalAirport} onChange={setArrivalAirport} placeholder="City or airport code" />
            </Field>
            <DateField
              label="Departs"
              mode="datetime"
              value={departureDateTime}
              onChange={setDepartureDateTime}
              defaultDay={defaultDay}
              optional
            />
            <DateField
              label="Arrives"
              mode="datetime"
              value={arrivalDateTime}
              onChange={setArrivalDateTime}
              defaultDay={departureDateTime.slice(0, 10) || defaultDay}
              optional
            />
            <TextField label="Flight" placeholder="Optional, e.g. SQ 638" value={name} onChangeText={setName} />
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    </View>
  );
}

export function ItineraryTab({
  tripId,
  trip,
  places,
  onChange,
  onEditDates,
}: {
  tripId: string;
  trip: TripDetail;
  places: Place[];
  onChange: () => void;
  /** Opens the trip-dates editor (owned by the trip screen, next to the hero). */
  onEditDates: () => void;
}) {
  const colors = useTheme();
  const showDialog = useDialog();
  const styles = createStyles(colors);
  // null = closed, 'new' = adding, else the place being edited.
  const [editing, setEditing] = useState<Place | 'new' | null>(null);
  const [showDiscover, setShowDiscover] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [weather, setWeather] = useState<Map<string, DayForecast>>(new Map());

  const startDate = trip.startDate?.slice(0, 10) ?? '';
  const endDate = trip.endDate?.slice(0, 10) ?? '';
  const days = startDate && endDate ? daysBetween(startDate, endDate) : [];

  useEffect(() => {
    if (trip.destinationLat == null || trip.destinationLng == null || days.length === 0) {
      setWeather(new Map());
      return;
    }
    let cancelled = false;
    fetchWeather(trip.destinationLat, trip.destinationLng, days[0], days[days.length - 1]).then((result) => {
      if (!cancelled) setWeather(result);
    });
    return () => {
      cancelled = true;
    };
  }, [trip.destinationLat, trip.destinationLng, startDate, endDate]);

  const daySet = new Set(days);
  const byDay = new Map<string, Place[]>();
  const unscheduled: Place[] = [];
  for (const p of places) {
    const keys = dayKeysFor(p).filter((k) => daySet.has(k));
    if (keys.length > 0) {
      for (const key of keys) {
        if (!byDay.has(key)) byDay.set(key, []);
        byDay.get(key)!.push(p);
      }
    } else {
      unscheduled.push(p);
    }
  }
  for (const [day, dayPlaces] of byDay) {
    dayPlaces.sort((a, b) => sortTimeForDay(a, day) - sortTimeForDay(b, day));
  }

  const routeStops = toRouteStops(places);

  const handleDelete = (place: Place) => {
    showDialog({
      title: 'Remove item',
      message: `Remove "${place.name}" from the itinerary?`,
      actions: [
        {
          label: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setDeleteError(null);
            setDeletingId(place.id);
            try {
              await api.deletePlace(tripId, place.id);
              if (expandedId === place.id) setExpandedId(null);
              onChange();
            } catch (err) {
              setDeleteError(err instanceof Error ? err.message : 'Could not remove item');
            } finally {
              setDeletingId(null);
            }
          },
        },
        { label: 'Cancel', style: 'cancel' },
      ],
    });
  };

  const renderRow = (place: Place, opts: { day?: string; stopNumber?: number; last: boolean }) => {
    const subtitle = placeSubtitle(place, opts.day);
    const isTransitionDay =
      place.type === 'HOTEL' &&
      !!opts.day &&
      (opts.day === place.checkIn?.slice(0, 10) || opts.day === place.checkOut?.slice(0, 10));
    const isExpanded = expandedId === place.id;

    return (
      <View key={place.id} style={[styles.rowWrap, !opts.last && styles.rowDivider]}>
        <Tappable
          style={styles.row}
          onPress={() => setExpandedId(isExpanded ? null : place.id)}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
        >
          <View style={[styles.badge, place.type !== 'STOP' && styles.badgeMuted]}>
            {place.type === 'STOP' && opts.stopNumber !== undefined ? (
              <Text style={styles.badgeNumber}>{opts.stopNumber}</Text>
            ) : (
              <TypeIcon type={place.type} color={place.type === 'STOP' ? colors.onRoute : colors.heroText} size={15} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle} numberOfLines={2}>
              {place.name}
            </Text>
            {subtitle ? (
              <Text style={[styles.rowSub, isTransitionDay && styles.rowSubStrong]} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </Tappable>
        {isExpanded && (
          <View style={styles.rowActions}>
            <Button label="Edit" variant="secondary" size="sm" onPress={() => setEditing(place)} />
            <Button
              label={deletingId === place.id ? 'Removing…' : 'Remove'}
              variant="text"
              tone="danger"
              onPress={() => handleDelete(place)}
              disabled={deletingId === place.id}
            />
          </View>
        )}
      </View>
    );
  };

  /** Rows for one list, numbering only the stops (hotels and flights get icons). */
  const renderRows = (list: Place[], day?: string) => {
    let stopNumber = 0;
    return list.map((place, i) =>
      renderRow(place, {
        day,
        stopNumber: place.type === 'STOP' ? ++stopNumber : undefined,
        last: i === list.length - 1,
      }),
    );
  };

  return (
    <View>
      {deleteError ? <Text style={styles.error}>{deleteError}</Text> : null}

      <RouteMap stops={routeStops} />

      <View style={styles.planActions}>
        <Button label="Add to itinerary" onPress={() => setEditing('new')} style={{ flex: 1 }} />
        <Button label="Discover places" variant="secondary" onPress={() => setShowDiscover(true)} style={{ flex: 1 }} />
      </View>

      {days.length === 0 ? (
        <View>
          <View style={styles.noDates}>
            <CalendarBlank size={22} color={colors.route} />
            <View style={{ flex: 1 }}>
              <Text style={styles.noDatesTitle}>Add your travel dates</Text>
              <Text style={styles.noDatesText}>Then everything you add lands on the right day.</Text>
            </View>
            <Button label="Set dates" variant="secondary" size="sm" onPress={onEditDates} />
          </View>
          {places.length === 0 ? (
            <Text style={styles.empty}>Nothing planned yet. Add a stop, a hotel or a flight to start.</Text>
          ) : (
            <View style={styles.dayCard}>{renderRows(places)}</View>
          )}
        </View>
      ) : (
        <View>
          {days.map((day, i) => {
            const dayPlaces = byDay.get(day) ?? [];
            return (
              <View key={day} style={styles.day}>
                <View style={styles.dayHead}>
                  <Text style={styles.dayNumber}>Day {i + 1}</Text>
                  <Text style={styles.dayDate}>{formatDayLong(day)}</Text>
                  <View style={{ flex: 1 }} />
                  <DayWeather forecast={weather.get(day)} />
                </View>
                {dayPlaces.length === 0 ? (
                  <Text style={styles.dayEmpty}>Nothing planned yet</Text>
                ) : (
                  <View style={styles.dayCard}>{renderRows(dayPlaces, day)}</View>
                )}
              </View>
            );
          })}

          {unscheduled.length > 0 && (
            <View style={styles.day}>
              <View style={styles.dayHead}>
                <Text style={styles.dayDate}>Unscheduled</Text>
              </View>
              <View style={styles.dayCard}>{renderRows(unscheduled)}</View>
            </View>
          )}
        </View>
      )}

      <Modal
        visible={editing !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditing(null)}
      >
        {editing !== null && (
          <PlaceEditor
            key={editing === 'new' ? 'new' : editing.id}
            tripId={tripId}
            initial={editing === 'new' ? undefined : editing}
            defaultDay={days[0]}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              setExpandedId(null);
              onChange();
            }}
          />
        )}
      </Modal>

      <DiscoverSheet
        visible={showDiscover}
        tripId={tripId}
        trip={trip}
        days={days}
        onAdded={onChange}
        onClose={() => setShowDiscover(false)}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    planActions: { flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 24 },
    error: { color: colors.owe, fontSize: typeScale.footnote, marginBottom: 12 },
    empty: { fontSize: typeScale.subhead, lineHeight: 21, color: colors.inkSoft, paddingVertical: 8 },

    noDates: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: radius.md,
      backgroundColor: colors.routeSoft,
      marginBottom: 16,
    },
    noDatesTitle: { fontSize: typeScale.subhead, fontWeight: '600', color: colors.ink },
    noDatesText: { fontSize: typeScale.footnote, color: colors.inkSoft, marginTop: 2 },

    day: { marginBottom: 22 },
    dayHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 8, paddingHorizontal: 2 },
    dayNumber: {
      fontSize: typeScale.caption,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.route,
    },
    dayDate: { fontSize: typeScale.body, fontWeight: '600', letterSpacing: -0.2, color: colors.ink },
    dayEmpty: {
      fontSize: typeScale.footnote,
      color: colors.inkSoft,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.rule,
    },
    dayCard: { borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' },

    rowWrap: { paddingHorizontal: 14 },
    rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
    badge: {
      width: 30,
      height: 30,
      borderRadius: radius.sm + 1,
      backgroundColor: colors.route,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeMuted: { backgroundColor: colors.routeSoft },
    badgeNumber: { fontSize: typeScale.footnote, fontWeight: '700', color: colors.onRoute, fontVariant: ['tabular-nums'] },
    rowTitle: { fontSize: typeScale.subhead, fontWeight: '600', color: colors.ink },
    rowSub: { fontSize: typeScale.footnote, color: colors.inkSoft, marginTop: 2 },
    rowSubStrong: { fontWeight: '600', color: colors.route },
    rowActions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingBottom: 12, paddingLeft: 42 },

    sheet: { flex: 1, backgroundColor: colors.bg },
    sheetHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.rule,
    },
    sheetTitle: { fontSize: typeScale.body, fontWeight: '600', color: colors.ink },
    sheetBody: { padding: 20 },
    segmented: {
      flexDirection: 'row',
      padding: 3,
      borderRadius: radius.sm + 3,
      backgroundColor: colors.rule,
      marginBottom: 20,
    },
    segment: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 38,
      borderRadius: radius.sm,
    },
    segmentSelected: { backgroundColor: colors.surface, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)' },
    segmentLabel: { fontSize: typeScale.footnote, fontWeight: '500', color: colors.inkSoft },
    segmentLabelSelected: { fontWeight: '600', color: colors.ink },
  });
}
