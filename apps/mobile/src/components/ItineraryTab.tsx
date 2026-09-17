import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Place, TripDetail } from '../api';
import { api } from '../api';
import { colors } from '../theme';

function daysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const cur = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (cur <= last) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function formatDay(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
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
  const [name, setName] = useState('');
  const [visitDate, setVisitDate] = useState('');

  const [startDate, setStartDate] = useState(trip.startDate?.slice(0, 10) ?? '');
  const [endDate, setEndDate] = useState(trip.endDate?.slice(0, 10) ?? '');
  const [dateError, setDateError] = useState<string | null>(null);
  const days = startDate && endDate ? daysBetween(startDate, endDate) : [];

  const byDay = new Map<string, Place[]>();
  const unscheduled: Place[] = [];
  for (const p of places) {
    const key = p.visitDate?.slice(0, 10);
    if (key && days.includes(key)) {
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(p);
    } else {
      unscheduled.push(p);
    }
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

  const handleAdd = async () => {
    if (!name.trim()) return;
    await api.addPlace(tripId, { name: name.trim(), visitDate: visitDate || undefined });
    setName('');
    setVisitDate('');
    onChange();
  };

  const renderRow = (place: Place) => (
    <View style={styles.row} key={place.id}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{place.name}</Text>
        {place.notes ? <Text style={styles.rowSub}>{place.notes}</Text> : null}
      </View>
    </View>
  );

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

    {days.length === 0 ? (
        places.length === 0 ? (
          <Text style={styles.empty}>No stops yet. Set trip dates to plan day by day.</Text>
        ) : (
          places.map(renderRow)
        )
      ) : (
        <View>
          {days.map((day) => (
            <View key={day} style={{ marginBottom: 20 }}>
              <Text style={styles.dayHeader}>{formatDay(day)}</Text>
              {(byDay.get(day) ?? []).length === 0 ? (
                <Text style={styles.empty}>No stops planned.</Text>
              ) : (
                (byDay.get(day) ?? []).map(renderRow)
              )}
            </View>
          ))}

          {unscheduled.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={[styles.dayHeader, { color: colors.inkSoft }]}>Unscheduled</Text>
              {unscheduled.map(renderRow)}
            </View>
          )}
        </View>
      )}

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Add a stop (e.g. Senso-ji Temple)"
          placeholderTextColor={colors.inkSoft}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={[styles.input, { flex: 0.7 }]}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.inkSoft}
          value={visitDate}
          onChangeText={setVisitDate}
          onSubmitEditing={handleAdd}
        />
        <Pressable style={styles.button} onPress={handleAdd}>
          <Text style={styles.buttonText}>Add stop</Text>
        </Pressable>
      </View>
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
  },
  rowTitle: { fontSize: 15, fontWeight: '500', color: colors.ink },
  rowSub: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  form: { flexDirection: 'row', gap: 8, marginTop: 16 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  button: {
    backgroundColor: colors.route,
    borderRadius: 6,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});