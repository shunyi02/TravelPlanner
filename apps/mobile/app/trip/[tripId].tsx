import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { api, type TripDetail, type Expense } from '../../src/api';
import { ItineraryTab } from '../../src/components/ItineraryTab';
import { ExpensesTab } from '../../src/components/ExpensesTab';
import { BalancesTab } from '../../src/components/BalancesTab';
import { colors } from '../../src/theme';

type Tab = 'itinerary' | 'expenses' | 'balances';

export default function TripDetailScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const navigation = useNavigation();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tab, setTab] = useState<Tab>('itinerary');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!tripId) return;
    setError(null);
    Promise.all([api.getTrip(tripId), api.listExpenses(tripId)])
      .then(([t, e]) => {
        setTrip(t);
        setExpenses(e);
        navigation.setOptions({ title: t.name });
      })
      .catch((err) => setError(err.message));
  }, [tripId, navigation]);

  useFocusEffect(load);
  useEffect(load, [load]);

  if (!tripId) return null;

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>Couldn't load trip: {error}</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>Loading…</Text>
      </View>
    );
  }

  const memberNames = Object.fromEntries(trip.members.map((m) => [m.userId, m.user.name]));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <View style={styles.tabRow}>
        {(['itinerary', 'expenses', 'balances'] as const).map((t) => (
          <Pressable key={t} style={styles.tabButton} onPress={() => setTab(t)}>
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
              {t[0].toUpperCase() + t.slice(1)}
            </Text>
            {tab === t && <View style={styles.tabUnderline} />}
          </Pressable>
        ))}
      </View>

      {tab === 'itinerary' && <ItineraryTab tripId={tripId} places={trip.places} onChange={load} />}
      {tab === 'expenses' && (
        <ExpensesTab tripId={tripId} expenses={expenses} memberNames={memberNames} onChange={load} />
      )}
      {tab === 'balances' && <BalancesTab tripId={tripId} memberNames={memberNames} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  empty: { color: colors.inkSoft, padding: 20 },
  tabRow: {
    flexDirection: 'row',
    gap: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    marginBottom: 20,
  },
  tabButton: { paddingBottom: 10 },
  tabLabel: { color: colors.inkSoft, fontWeight: '500' },
  tabLabelActive: { color: colors.ink },
  tabUnderline: {
    height: 2,
    backgroundColor: colors.route,
    marginTop: 8,
  },
});
