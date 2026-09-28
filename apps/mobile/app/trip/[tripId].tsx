import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { api, type TripDetail, type Expense } from '../../src/api';
import { useAuth } from '../../src/authContext';
import { ItineraryTab } from '../../src/components/ItineraryTab';
import { BookingsTab } from '../../src/components/BookingsTab';
import { ChecklistTab } from '../../src/components/ChecklistTab';
import { ExpensesTab } from '../../src/components/ExpensesTab';
import { BalancesTab } from '../../src/components/BalancesTab';
import { MembersTab } from '../../src/components/MembersTab';
import { ReportTab } from '../../src/components/ReportTab';
import { TripDatesSheet } from '../../src/components/TripDatesSheet';
import { TripHero } from '../../src/components/TripHero';
import { radius, typeScale, useTheme, type ThemeColors } from '../../src/theme';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/Field';

/** Three top-level groups; the ones holding more than one view get a segmented control. */
const GROUPS = {
  plan: { label: 'Plan', views: ['itinerary', 'bookings', 'checklist'] },
  money: { label: 'Money', views: ['expenses', 'balances', 'report'] },
  people: { label: 'People', views: ['members'] },
} as const;

type Group = keyof typeof GROUPS;
type TripView = (typeof GROUPS)[Group]['views'][number];

const VIEW_LABELS: Record<TripView, string> = {
  itinerary: 'Itinerary',
  bookings: 'Bookings',
  checklist: 'Checklist',
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
  const [editingDates, setEditingDates] = useState(false);
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
      <View style={[styles.container, styles.state]}>
        <Text style={styles.stateTitle}>Couldn't load this trip</Text>
        <Text style={styles.stateText}>{error}</Text>
        <Button label="Try again" variant="secondary" onPress={load} style={{ alignSelf: 'flex-start', marginTop: 20 }} />
      </View>
    );
  }

  if (!trip) {
    // Shaped like the screen it stands in for: the hero, the group bar, then rows.
    return (
      <View style={styles.container} accessibilityLabel="Loading trip">
        <View style={styles.skeletonHero} />
        <View style={styles.content}>
          {[70, 45, 85, 55].map((w, i) => (
            <View key={i} style={[styles.skeletonLine, { width: `${w}%` }]} />
          ))}
        </View>
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
      <TripHero trip={trip} onEditDates={() => setEditingDates(true)} />

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

        {view === 'itinerary' && (
          <ItineraryTab
            tripId={tripId}
            trip={trip}
            places={trip.places}
            onChange={load}
            onEditDates={() => setEditingDates(true)}
          />
        )}
        {view === 'bookings' && <BookingsTab places={trip.places} memberNames={memberNames} />}
        {view === 'checklist' && <ChecklistTab tripId={tripId} memberNames={memberNames} currentUserId={currentUser?.id} />}
        {view === 'expenses' && (
          <ExpensesTab
            tripId={tripId}
            expenses={expenses}
            memberNames={memberNames}
            currency={trip.currency}
            budget={trip.budget}
            currentUserId={currentUser?.id}
            onChange={load}
          />
        )}
        {view === 'balances' && (
          <BalancesTab
            tripId={tripId}
            memberNames={memberNames}
            currency={trip.currency}
            currentUserId={currentUser?.id}
          />
        )}
        {view === 'report' && (
          <ReportTab
            tripId={tripId}
            trip={trip}
            expenses={expenses}
            memberNames={memberNames}
            onChange={load}
            onGoToExpenses={() => setViewByGroup((prev) => ({ ...prev, money: 'expenses' }))}
            onGoToBalances={() => setViewByGroup((prev) => ({ ...prev, money: 'balances' }))}
          />
        )}
        {view === 'members' && (
          <>
            <MembersTab tripId={tripId} trip={trip} isOwner={isOwner} onChange={load} />

            {/* Owner-only trip settings live with the other owner controls, not above every tab.
                Everyone else already sees the currency in the hero. */}
            {isOwner && (
              <View style={styles.settings}>
                <Text style={styles.sectionLabel}>Trip settings</Text>
                <View style={styles.currencyRow}>
                  <View style={{ width: 120 }}>
                    <TextField
                      label="Currency"
                      placeholder="USD"
                      autoCapitalize="characters"
                      maxLength={3}
                      value={currencyInput}
                      onChangeText={(v) => setCurrencyInput(v.toUpperCase())}
                      error={currencyError}
                    />
                  </View>
                  <Button
                    label="Save"
                    variant="secondary"
                    onPress={handleSaveCurrency}
                    disabled={currencyInput.trim() === trip.currency}
                    style={styles.currencySave}
                  />
                </View>
                <Text style={styles.settingsNote}>Expenses and the report are shown in this currency.</Text>
              </View>
            )}
          </>
        )}
      </View>
      <TripDatesSheet
        // Remount when the saved dates change, so the fields start from them.
        key={`${trip.startDate}-${trip.endDate}`}
        trip={trip}
        visible={editingDates}
        onClose={() => setEditingDates(false)}
        onSaved={load}
      />
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    state: { justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 48 },
    stateTitle: { fontSize: typeScale.title1, fontWeight: '700', letterSpacing: -0.5, color: colors.ink, marginBottom: 8 },
    stateText: { fontSize: typeScale.subhead, lineHeight: 21, color: colors.inkSoft },
    skeletonHero: { height: 280, backgroundColor: colors.hero },
    skeletonLine: { height: 14, borderRadius: 4, backgroundColor: colors.rule, marginBottom: 18 },
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 20, paddingBottom: 48 },

    groupBar: {
      flexDirection: 'row',
      backgroundColor: colors.bg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.rule,
      paddingHorizontal: 8,
    },
    groupTab: { flex: 1, alignItems: 'center', paddingTop: 14, minHeight: 48 },
    groupLabel: { fontSize: typeScale.subhead, fontWeight: '500', color: colors.inkSoft },
    groupLabelActive: { color: colors.ink, fontWeight: '600' },
    groupUnderline: { height: 3, width: 28, borderRadius: 2, marginTop: 10, backgroundColor: 'transparent' },
    groupUnderlineActive: { backgroundColor: colors.route },

    segmented: {
      flexDirection: 'row',
      backgroundColor: colors.routeSoft,
      borderRadius: radius.sm + 2,
      padding: 3,
      marginBottom: 20,
    },
    segment: { flex: 1, minHeight: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    segmentActive: {
      backgroundColor: colors.surface,
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
    },
    segmentLabel: { fontSize: typeScale.footnote, fontWeight: '500', color: colors.inkSoft },
    segmentLabelActive: { color: colors.ink, fontWeight: '600' },

    settings: { marginTop: 24, padding: 16, borderRadius: radius.md, backgroundColor: colors.surface },
    sectionLabel: { fontSize: typeScale.body, fontWeight: '600', color: colors.ink, marginBottom: 12 },
    currencyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    // Lines the button up with the input, below the field's label.
    currencySave: { marginTop: 22 },
    settingsNote: { fontSize: typeScale.footnote, color: colors.inkSoft },
  });
}
