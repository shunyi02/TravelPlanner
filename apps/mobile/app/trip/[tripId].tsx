import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { api, type TripDetail, type Expense } from '../../src/api';
import { useAuth } from '../../src/authContext';
import { ItineraryTab } from '../../src/components/ItineraryTab';
import { BookingsTab } from '../../src/components/BookingsTab';
import { ExpensesTab } from '../../src/components/ExpensesTab';
import { BalancesTab } from '../../src/components/BalancesTab';
import { MembersTab } from '../../src/components/MembersTab';
import { ReportTab } from '../../src/components/ReportTab';
import { TripHero } from '../../src/components/TripHero';
import { useTheme, type ThemeColors } from '../../src/theme';

type Tab = 'itinerary' | 'bookings' | 'expenses' | 'balances' | 'report' | 'members';

export default function TripDetailScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const navigation = useNavigation();
  const { currentUser } = useAuth();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tab, setTab] = useState<Tab>('itinerary');
  const [error, setError] = useState<string | null>(null);
  const [currencyInput, setCurrencyInput] = useState('');
  const [currencyError, setCurrencyError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!tripId) return;
    setError(null);
    Promise.all([api.getTrip(tripId), api.listExpenses(tripId)])
      .then(([t, e]) => {
        setTrip(t);
        setExpenses(e);
        setCurrencyInput(t.currency);
        navigation.setOptions({ title: t.name });
      })
      .catch((err) => setError(err.message));
  }, [tripId, navigation]);

  useFocusEffect(load);
  useEffect(load, [load]);

  const handleSaveCurrency = async () => {
    if (!tripId || !currencyInput.trim()) return;
    setCurrencyError(null);
    try {
      await api.updateTrip(tripId, { currency: currencyInput.trim().toUpperCase() });
      load();
    } catch (err) {
      setCurrencyError(err instanceof Error ? err.message : 'Could not change currency');
    }
  };

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
  const isOwner = trip.members.find((m) => m.userId === currentUser?.id)?.role === 'owner';

  return (
    <ScrollView style={styles.container}>
      <TripHero trip={trip} />
      <View style={{ padding: 20 }}>
      {isOwner ? (
        <View style={styles.currencyRow}>
          <TextInput
            style={styles.currencyInput}
            placeholder="Currency"
            placeholderTextColor={colors.inkSoft}
            autoCapitalize="characters"
            maxLength={3}
            value={currencyInput}
            onChangeText={(v) => setCurrencyInput(v.toUpperCase())}
          />
          <Pressable style={styles.currencySaveButton} onPress={handleSaveCurrency}>
            <Text style={styles.currencySaveButtonText}>Save</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.currencyReadOnly}>{trip.currency}</Text>
      )}
      {currencyError && <Text style={{ color: colors.owe, marginBottom: 12 }}>{currencyError}</Text>}

      {/* Six tabs overflow a phone's width, so the row scrolls sideways. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabRow}>
        {(['itinerary', 'bookings', 'expenses', 'balances', 'report', 'members'] as const).map((t) => (
          <Pressable key={t} style={styles.tabButton} onPress={() => setTab(t)}>
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
              {t[0].toUpperCase() + t.slice(1)}
            </Text>
            {tab === t && <View style={styles.tabUnderline} />}
          </Pressable>
        ))}
      </ScrollView>

      {tab === 'itinerary' && <ItineraryTab tripId={tripId} trip={trip} places={trip.places} onChange={load} />}
      {tab === 'bookings' && <BookingsTab places={trip.places} memberNames={memberNames} />}
      {tab === 'expenses' && (
        <ExpensesTab
          tripId={tripId}
          expenses={expenses}
          memberNames={memberNames}
          currency={trip.currency}
          currentUserId={currentUser?.id}
          onChange={load}
        />
      )}
      {tab === 'balances' && <BalancesTab tripId={tripId} memberNames={memberNames} />}
      {tab === 'report' && (
        <ReportTab tripId={tripId} trip={trip} expenses={expenses} memberNames={memberNames} onChange={load} />
      )}
      {tab === 'members' && <MembersTab tripId={tripId} trip={trip} isOwner={isOwner} onChange={load} />}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  empty: { color: colors.inkSoft, padding: 20 },
  tabScroll: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    marginBottom: 20,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 24,
  },
  tabButton: { paddingBottom: 10 },
  tabLabel: { color: colors.inkSoft, fontWeight: '500' },
  tabLabelActive: { color: colors.ink },
  tabUnderline: {
    height: 2,
    backgroundColor: colors.route,
    marginTop: 8,
  },
  currencyRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  currencyInput: {
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    color: colors.ink,
    width: 90,
  },
  currencySaveButton: {
    backgroundColor: colors.route,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  currencySaveButtonText: { color: '#fff', fontWeight: '600' },
  currencyReadOnly: { color: colors.inkSoft, marginBottom: 16 },
  });
}
