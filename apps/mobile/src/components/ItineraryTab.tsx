import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Place, PlaceType, TripDetail } from '../api';
import { api } from '../api';
import { colors } from '../theme';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

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

function formatDay(iso: string) {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
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
    const dep = place.departureTime ? new Date(place.departureTime).toLocaleString() : '';
    const arr = place.arrivalTime ? new Date(place.arrivalTime).toLocaleString() : '';
    return `${from} → ${to}${dep ? ` · dep ${dep}` : ''}${arr ? ` · arr ${arr}` : ''}`;
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

/** ISO datetime -> "YYYY-MM-DD HH:mm" in local time, for the plain-text date/time
 *  fields below (no native date picker is installed in this app). */
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
    throw new Error(`Invalid date/time "${raw}" — use YYYY-MM-DD HH:mm`);
  }
  return d.toISOString();
}

type PlaceInput = Parameters<typeof api.addPlace>[1];

/** Add/edit form for a single itinerary item. Used both for creating a new
 *  place (no `initial`) and editing an existing one (`initial` set, type
 *  switchable). */
function PlaceEditor({
  tripId,
  initial,
  onCancel,
  onSaved,
}: {
  tripId: string;
  initial?: Place;
  onCancel?: () => void;
  onSaved: () => void;
}) {
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
  const [locationResults, setLocationResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [touchedLocation, setTouchedLocation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced Nominatim (OpenStreetMap) search — free, no API key.
  // Rate-limited to ~1req/s per their usage policy, so wait for typing to pause.
  useEffect(() => {
    if (!touchedLocation || type !== 'STOP' || locationQuery.trim().length < 3) {
      setLocationResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(locationQuery)}`,
        );
        const data: NominatimResult[] = await res.json();
        setLocationResults(data);
      } catch {
        setLocationResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [locationQuery, type, touchedLocation]);

  const pickLocation = (result: NominatimResult) => {
    setName(result.display_name.split(',')[0]);
    setLat(parseFloat(result.lat));
    setLng(parseFloat(result.lon));
    setLocationQuery(result.display_name);
    setLocationResults([]);
  };

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    try {
      const payload: PlaceInput = { type, name: name.trim() };
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
      setError(err instanceof Error ? err.message : `Could not ${initial ? 'save' : 'add'} item`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.editor}>
      <View style={styles.typeRow}>
        {(['STOP', 'HOTEL', 'FLIGHT'] as PlaceType[]).map((t) => (
          <Pressable key={t} style={[styles.typeButton, type === t && styles.typeButtonActive]} onPress={() => setType(t)}>
            <Text style={[styles.typeButtonText, type === t && styles.typeButtonTextActive]}>
              {t === 'STOP' ? 'Stop' : t === 'HOTEL' ? 'Hotel' : 'Flight'}
            </Text>
          </Pressable>
        ))}
      </View>

      {type === 'STOP' ? (
        <View>
          <TextInput
            style={styles.input}
            placeholder="Search a place…"
            placeholderTextColor={colors.inkSoft}
            value={locationQuery}
            onChangeText={(v) => {
              setTouchedLocation(true);
              setLocationQuery(v);
              setName(v);
              setLat(undefined);
              setLng(undefined);
            }}
          />
          {searching && <Text style={styles.hint}>Searching…</Text>}
          {locationResults.map((r) => (
            <Pressable key={r.place_id} onPress={() => pickLocation(r)} style={styles.resultRow}>
              <Text style={styles.resultText}>{r.display_name}</Text>
            </Pressable>
          ))}
          {lat !== undefined && lng !== undefined && (
            <Text style={[styles.hint, { color: colors.route }]}>
              📍 {lat.toFixed(5)}, {lng.toFixed(5)}
            </Text>
          )}
        </View>
      ) : (
        <TextInput
          style={styles.input}
          placeholder="Name"
          placeholderTextColor={colors.inkSoft}
          value={name}
          onChangeText={setName}
        />
      )}

      {type === 'STOP' && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Visit date & time (YYYY-MM-DD HH:mm, optional)"
            placeholderTextColor={colors.inkSoft}
            value={visitDateTime}
            onChangeText={setVisitDateTime}
          />
          <TextInput
            style={styles.input}
            placeholder="Notes (optional)"
            placeholderTextColor={colors.inkSoft}
            value={notes}
            onChangeText={setNotes}
          />
        </>
      )}

      {type === 'HOTEL' && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Check-in (YYYY-MM-DD HH:mm)"
            placeholderTextColor={colors.inkSoft}
            value={checkInDateTime}
            onChangeText={setCheckInDateTime}
          />
          <TextInput
            style={styles.input}
            placeholder="Check-out (YYYY-MM-DD HH:mm)"
            placeholderTextColor={colors.inkSoft}
            value={checkOutDateTime}
            onChangeText={setCheckOutDateTime}
          />
        </>
      )}

      {type === 'FLIGHT' && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Departure airport"
            placeholderTextColor={colors.inkSoft}
            value={departureAirport}
            onChangeText={setDepartureAirport}
          />
          <TextInput
            style={styles.input}
            placeholder="Arrival airport"
            placeholderTextColor={colors.inkSoft}
            value={arrivalAirport}
            onChangeText={setArrivalAirport}
          />
          <TextInput
            style={styles.input}
            placeholder="Departure (YYYY-MM-DD HH:mm)"
            placeholderTextColor={colors.inkSoft}
            value={departureDateTime}
            onChangeText={setDepartureDateTime}
          />
          <TextInput
            style={styles.input}
            placeholder="Arrival (YYYY-MM-DD HH:mm)"
            placeholderTextColor={colors.inkSoft}
            value={arrivalDateTime}
            onChangeText={setArrivalDateTime}
          />
        </>
      )}

      {error && <Text style={{ color: colors.owe, marginTop: 4 }}>{error}</Text>}

      <View style={styles.rowActions}>
        <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
          <Text style={styles.buttonText}>{saving ? 'Saving…' : initial ? 'Save' : 'Add'}</Text>
        </Pressable>
        {onCancel && (
          <Pressable style={styles.buttonOutline} onPress={onCancel}>
            <Text style={[styles.buttonText, { color: colors.route }]}>Cancel</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function ItineraryTab({
  tripId,
  trip,
  places,
  onChange,
}: {
  tripId: string;
  trip: TripDetail;
  places: Place[];
  onChange: () => void;
}) {
  const [startDate, setStartDate] = useState(trip.startDate?.slice(0, 10) ?? '');
  const [endDate, setEndDate] = useState(trip.endDate?.slice(0, 10) ?? '');
  const [dateError, setDateError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const days = startDate && endDate ? daysBetween(startDate, endDate) : [];

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

  const handleSaveDates = async () => {
    setDateError(null);
    try {
      await api.updateTripDates(tripId, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      onChange();
    } catch (err) {
      setDateError(err instanceof Error ? err.message : 'Could not save dates');
    }
  };

  const handleDelete = (place: Place) => {
    Alert.alert('Remove item', `Remove "${place.name}" from the itinerary?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
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
    ]);
  };

  const renderRow = (place: Place, opts?: { day?: string; index?: number }) => {
    if (editingId === place.id) {
      return (
        <PlaceEditor
          key={place.id}
          tripId={tripId}
          initial={place}
          onCancel={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            onChange();
          }}
        />
      );
    }

    const subtitle = placeSubtitle(place, opts?.day);
    const isTransitionDay =
      place.type === 'HOTEL' &&
      !!opts?.day &&
      (opts.day === place.checkIn?.slice(0, 10) || opts.day === place.checkOut?.slice(0, 10));
    const isExpanded = expandedId === place.id;

    return (
      <View key={place.id}>
        <Pressable style={styles.row} onPress={() => setExpandedId(isExpanded ? null : place.id)}>
          {opts?.index !== undefined && <Text style={styles.stopIndex}>{opts.index + 1}</Text>}
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>
              {place.type === 'FLIGHT' ? '✈ ' : place.type === 'HOTEL' ? '🏨 ' : ''}
              {place.name}
            </Text>
            {subtitle ? (
              <Text style={[styles.rowSub, isTransitionDay && { fontWeight: '600', color: colors.route }]}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </Pressable>
        {isExpanded && (
          <View style={styles.rowActions}>
            <Pressable onPress={() => setEditingId(place.id)}>
              <Text style={styles.textBtn}>Edit</Text>
            </Pressable>
            <Pressable onPress={() => handleDelete(place)} disabled={deletingId === place.id}>
              <Text style={[styles.textBtn, { color: colors.owe }]}>
                {deletingId === place.id ? 'Removing…' : 'Remove'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <View>
      <View style={styles.dateForm}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Start (YYYY-MM-DD)"
          placeholderTextColor={colors.inkSoft}
          value={startDate}
          onChangeText={setStartDate}
        />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="End (YYYY-MM-DD)"
          placeholderTextColor={colors.inkSoft}
          value={endDate}
          onChangeText={setEndDate}
        />
        <Pressable style={styles.button} onPress={handleSaveDates}>
          <Text style={styles.buttonText}>Save</Text>
        </Pressable>
      </View>
      {dateError ? <Text style={{ color: colors.owe, marginBottom: 16 }}>{dateError}</Text> : null}
      {deleteError ? <Text style={{ color: colors.owe, marginBottom: 16 }}>{deleteError}</Text> : null}

      <Pressable
        style={[styles.buttonOutline, { alignSelf: 'flex-start', marginBottom: 16 }]}
        onPress={() => setShowAddForm(!showAddForm)}
      >
        <Text style={[styles.buttonText, { color: colors.route }]}>{showAddForm ? 'Close' : '+ Add'}</Text>
      </Pressable>

      {showAddForm && (
        <PlaceEditor
          tripId={tripId}
          onCancel={() => setShowAddForm(false)}
          onSaved={() => {
            setShowAddForm(false);
            onChange();
          }}
        />
      )}

      {days.length === 0 ? (
        places.length === 0 ? (
          <Text style={styles.empty}>No stops yet. Set trip dates to plan day by day.</Text>
        ) : (
          places.map((place, index) => renderRow(place, { index }))
        )
      ) : (
        <View>
          {days.map((day) => (
            <View key={day} style={{ marginBottom: 20 }}>
              <Text style={styles.dayHeader}>{formatDay(day)}</Text>
              {(byDay.get(day) ?? []).length === 0 ? (
                <Text style={styles.empty}>No stops planned.</Text>
              ) : (
                (byDay.get(day) ?? []).map((place) => renderRow(place, { day }))
              )}
            </View>
          ))}

          {unscheduled.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={[styles.dayHeader, { color: colors.inkSoft }]}>Unscheduled</Text>
              {unscheduled.map((place) => renderRow(place))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dateForm: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  empty: { color: colors.inkSoft, paddingVertical: 16 },
  dayHeader: { fontSize: 15, fontWeight: '600', color: colors.ink, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    gap: 8,
  },
  stopIndex: { color: colors.inkSoft, fontSize: 12, width: 18 },
  rowTitle: { fontSize: 15, fontWeight: '500', color: colors.ink },
  rowSub: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 16, paddingVertical: 8, paddingLeft: 12 },
  textBtn: { color: colors.route, fontSize: 13, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    color: colors.ink,
    marginBottom: 8,
  },
  button: {
    backgroundColor: colors.route,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: colors.route,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  editor: {
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    backgroundColor: colors.surface,
  },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  typeButton: {
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  typeButtonActive: { backgroundColor: colors.route, borderColor: colors.route },
  typeButtonText: { fontSize: 12, color: colors.ink },
  typeButtonTextActive: { color: '#fff' },
  hint: { fontSize: 12, color: colors.inkSoft, marginTop: -4, marginBottom: 8 },
  resultRow: {
    borderWidth: 1,
    borderColor: colors.rule,
    borderTopWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  resultText: { fontSize: 13, color: colors.ink },
});
