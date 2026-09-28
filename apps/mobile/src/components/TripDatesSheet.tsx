import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dayDelta, dayKeysFor } from '@travel-planner/shared';
import { api, type TripDetail } from '../api';
import { radius, typeScale, useTheme, type ThemeColors } from '../theme';
import { dayCount } from '../tripDates';
import { Button } from './Button';
import { DateField } from './DateField';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Sheet for changing the trip's dates, opened from the dates in the trip hero.
 *  The mobile counterpart of web's TripDatesEditor, including the option to move
 *  the itinerary along with a new start date (done server-side, in one request). */
export function TripDatesSheet({
  trip,
  visible,
  onClose,
  onSaved,
}: {
  trip: TripDetail;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const origStart = trip.startDate?.slice(0, 10) ?? '';
  const origEnd = trip.endDate?.slice(0, 10) ?? '';
  const [start, setStart] = useState(origStart);
  const [end, setEnd] = useState(origEnd);
  const [move, setMove] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = Boolean(start && end);
  const backwards = complete && end < start;
  const delta = origStart && start ? dayDelta(origStart, start) : 0;
  const datedCount = trip.places.filter((p) => dayKeysFor(p).length > 0).length;
  const canMove = delta !== 0 && datedCount > 0;
  const unchanged = start === origStart && end === origEnd;

  const close = () => {
    setStart(origStart);
    setEnd(origEnd);
    setError(null);
    onClose();
  };

  const handleSave = async () => {
    if (!complete || backwards) return;
    setSaving(true);
    setError(null);
    try {
      await api.updateTrip(trip.id, {
        startDate: start,
        endDate: end,
        ...(canMove && move ? { shiftItineraryDays: delta } : {}),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the new dates');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={styles.sheet}>
        <View style={styles.head}>
          <Button label="Cancel" variant="text" onPress={close} />
          <Text style={styles.title}>Trip dates</Text>
          <Button
            label={saving ? 'Saving…' : 'Save'}
            variant="text"
            onPress={handleSave}
            disabled={!complete || backwards || unchanged || saving}
          />
        </View>
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}>
          <DateField label="First day" value={start} onChange={setStart} />
          <DateField
            label="Last day"
            value={end}
            onChange={setEnd}
            defaultDay={start}
            error={backwards ? 'The last day has to be on or after the first day.' : null}
          />

          {complete && !backwards && (
            <Text style={styles.summary}>
              {plural(dayCount(start, end), 'day')}
              {origStart && origEnd && !unchanged ? `, was ${plural(dayCount(origStart, origEnd), 'day')}` : ''}
            </Text>
          )}

          {canMove && (
            <View style={styles.moveRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.moveTitle}>Move the itinerary too</Text>
                <Text style={styles.moveText}>
                  Shifts {plural(datedCount, 'dated item')} {delta > 0 ? 'later' : 'earlier'} by{' '}
                  {plural(Math.abs(delta), 'day')}, keeping their times.
                </Text>
              </View>
              <Switch
                value={move}
                onValueChange={setMove}
                trackColor={{ true: colors.route, false: colors.rule }}
                accessibilityLabel="Move the itinerary too"
              />
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sheet: { flex: 1, backgroundColor: colors.bg },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.rule,
    },
    title: { fontSize: typeScale.body, fontWeight: '600', color: colors.ink },
    body: { padding: 20 },
    summary: { fontSize: typeScale.footnote, color: colors.inkSoft, marginTop: -4, marginBottom: 18 },
    moveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 14,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
    },
    moveTitle: { fontSize: typeScale.subhead, fontWeight: '600', color: colors.ink },
    moveText: { fontSize: typeScale.footnote, lineHeight: 18, color: colors.inkSoft, marginTop: 2 },
    error: { fontSize: typeScale.footnote, color: colors.owe, marginTop: 14 },
  });
}
