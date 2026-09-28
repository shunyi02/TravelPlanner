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
import { Button } from '../../src/components/Button';

/** Three top-level groups; the ones holding more than one view get a segmented control. */
const GROUPS = {
  plan: { label: 'Plan', views: ['itinerary', 'bookings'] },
  money: { label: 'Money', views: ['expenses', 'balances', 'report'] },
  people: { label: 'People', views: ['members'] },
} as const;

type Group = keyof typeof GROUPS;
type TripView = (typeof GROUPS)[Group]['views'][number];

const VIEW_LABELS: Record<TripView, string> = {
  itinerary: 'Itinerary',
  bookings: 'Bookings',
  expenses: 'Expenses',
  balances: 'Balances',
  report: 'Report',
  members: 'Members',
};

export default function TripDetailScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const navigation = useNavigation();
  const { currentUser } = useAuth();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [group, setGroup] = useState<Group>('plan');
  // Remember the last view inside each group, so hopping Plan → Money → Plan lands where you left off.
  const [viewByGroup, setViewByGroup] = useState<Record<Group, TripView>>({
    plan: 'itinerary',
    money: 'expenses',
    people: 'members',
  });
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
  const view = viewByGroup[group];
  const groupViews = GROUPS[group].views;

  return (
    // Child 1 (the group bar) pins under the navigation header once the hero scrolls away.
    <ScrollView style={styles.container} stickyHeaderIndices={[1]}>
      <TripHero trip={trip} />

      <View style={styles.groupBar} accessibilityRole="tablist">
        {(Object.keys(GROUPS) as Group[]).map((g) => {
          const active = g === group;
          return (
            <Pressable
              key={g}
              style={({ pressed }) => [styles.groupTab, pressed && !active && { opacity: 0.6 }]}
              onPress={() => setGroup(g)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.groupLabel, active && styles.groupLabelActive]}>{GROUPS[g].label}</Text>
              <View style={[styles.groupUnderline, active && styles.groupUnderlineActive]} />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.content}>
        {groupViews.length > 1 && (
          <View style={styles.segmented} accessibilityRole="tablist">
            {groupViews.map((v) => {
              const active = v === view;
              return (
                <Pressable
                  key={v}
                  style={({ pressed }) => [
                    styles.segment,
                    active && styles.segmentActive,
                    pressed && !active && { opacity: 0.6 },
                  ]}
                  onPress={() => setViewByGroup((prev) => ({ ...prev, [group]: v }))}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{VIEW_LABELS[v]}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {view === 'itinerary' && <ItineraryTab tripId={tripId} trip={trip} places={trip.places} onChange={load} />}
        {view === 'bookings' && <BookingsTab places={trip.places} memberNames={memberNames} />}
        {view === 'expenses' && (
          <ExpensesTab
            tripId={tripId}
            expenses={expenses}
            memberNames={memberNames}
            currency={trip.currency}
            currentUserId={currentUser?.id}
            onChange={load}
          />
        )}
        {view === 'balances' && <BalancesTab tripId={tripId} memberNames={memberNames} />}
        {view === 'report' && (
          <ReportTab tripId={tripId} trip={trip} expenses={expenses} memberNames={memberNames} onChange={load} />
        )}
        {view === 'members' && (
          <>
            <MembersTab tripId={tripId} trip={trip} isOwner={isOwner} onChange={load} />

            {/* Owner-only trip settings live with the other owner controls, not above every tab.
                Everyone else already sees the currency in the hero. */}
            {isOwner && (
              <View style={styles.settings}>
                <Text style={styles.sectionLabel}>Trip settings</Text>
                <Text style={styles.fieldLabel}>Currency</Text>
                <View style={styles.currencyRow}>
                  <TextInput
                    style={styles.currencyInput}
                    placeholder="USD"
                    placeholderTextColor={colors.inkSoft}
                    autoCapitalize="characters"
                    maxLength={3}
                    value={currencyInput}
                    onChangeText={(v) => setCurrencyInput(v.toUpperCase())}
                    accessibilityLabel="Trip currency"
                  />
                  <Button
                    label="Save"
                    variant="secondary"
                    onPress={handleSaveCurrency}
                    disabled={currencyInput.trim() === trip.currency}
                  />
                </View>
                {currencyError && <Text style={styles.error}>{currencyError}</Text>}
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    empty: { color: colors.inkSoft, padding: 20 },
    content: { padding: 20, paddingBottom: 48 },

    groupBar: {
      flexDirection: 'row',
      backgroundColor: colors.bg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.rule,
      paddingHorizontal: 8,
    },
    groupTab: { flex: 1, alignItems: 'center', paddingTop: 14, minHeight: 48 },
    groupLabel: { fontSize: 15, fontWeight: '500', color: colors.inkSoft },
    groupLabelActive: { color: colors.ink, fontWeight: '600' },
    groupUnderline: { height: 3, width: 28, borderRadius: 2, marginTop: 10, backgroundColor: 'transparent' },
    groupUnderlineActive: { backgroundColor: colors.route },

    segmented: {
      flexDirection: 'row',
      backgroundColor: colors.routeSoft,
      borderRadius: 10,
      padding: 3,
      marginBottom: 20,
    },
    segment: { flex: 1, minHeight: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    segmentActive: {
      backgroundColor: colors.surface,
      shadowColor: colors.hero,
      shadowOpacity: 0.12,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    segmentLabel: { fontSize: 14, fontWeight: '500', color: colors.inkSoft },
    segmentLabelActive: { color: colors.ink, fontWeight: '600' },

    settings: {
      marginTop: 32,
      paddingTop: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.rule,
    },
    sectionLabel: { fontSize: 17, fontWeight: '600', color: colors.ink, marginBottom: 12 },
    fieldLabel: { fontSize: 13, color: colors.inkSoft, marginBottom: 6 },
    currencyRow: { flexDirection: 'row', gap: 8 },
    currencyInput: {
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: 8,
      paddingHorizontal: 12,
      minHeight: 44,
      backgroundColor: colors.surface,
      color: colors.ink,
      width: 90,
      fontVariant: ['tabular-nums'],
    },
    error: { color: colors.owe, marginTop: 8 },
  });
}
