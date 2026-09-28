import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { EXPENSE_CATEGORIES, formatMoney } from '@travel-planner/shared';
import type { Expense, TripDetail } from '../api';
import { api } from '../api';
import { useAuth } from '../authContext';
import { SpendOverTimeChart } from './SpendOverTimeChart';
import { radius, typeScale, useTheme, type ThemeColors } from '../theme';
import { Button } from './Button';

const DAY_MS = 86_400_000;

/** Every calendar day ("YYYY-MM-DD") from `first` to `last` inclusive. */
function dayRange(first: string, last: string): string[] {
  const days: string[] = [];
  for (let t = Date.parse(`${first}T00:00:00Z`); t <= Date.parse(`${last}T00:00:00Z`); t += DAY_MS) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

/** The local calendar day of an ISO timestamp. */
function dateKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA');
}

function BudgetCard({
  tripId,
  budget,
  spent,
  currency,
  daysLeft,
  started,
  onChange,
}: {
  tripId: string;
  budget: string | null;
  spent: number;
  currency: string;
  /** Trip days still ahead (including today), or null once the trip is over. */
  daysLeft: number | null;
  /** Whether the trip has begun, which changes how the per-day hint reads. */
  started: boolean;
  onChange: () => void;
}) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const budgetNum = budget != null ? Number(budget) : null;
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(budget ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const money = (n: number) => formatMoney(n, currency);

  const handleSave = async () => {
    const parsed = input.trim() === '' ? null : Number(input);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      setError('Enter a valid amount, or leave it blank to clear the budget.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.updateTrip(tripId, { budget: parsed });
      setEditing(false);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save budget');
    } finally {
      setSaving(false);
    }
  };

  const form = (
    <View style={styles.budgetForm}>
      <TextInput
        style={styles.budgetInput}
        keyboardType="decimal-pad"
        placeholder={`Budget (${currency})`}
        placeholderTextColor={colors.inkSoft}
        accessibilityLabel={`Trip budget in ${currency}`}
        value={input}
        onChangeText={setInput}
        autoFocus
      />
      <Button label={saving ? 'Saving…' : 'Save'} onPress={handleSave} disabled={saving} />
      <Button
        label="Cancel"
        variant="text"
        onPress={() => {
          setEditing(false);
          setError(null);
          setInput(budget ?? '');
        }}
      />
    </View>
  );

  if (budgetNum == null) {
    return (
      <View style={styles.card}>
        <Text style={styles.heading}>Budget</Text>
        {editing ? (
          form
        ) : (
          <>
            <Text style={styles.note}>Set a budget to see how much is left as you go.</Text>
            <Button
              label="Set a budget"
              variant="secondary"
              onPress={() => setEditing(true)}
              style={{ alignSelf: 'flex-start', marginTop: 12 }}
            />
          </>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    );
  }

  const over = spent > budgetNum;
  const pctUsed = budgetNum > 0 ? (spent / budgetNum) * 100 : 100;
  const remaining = budgetNum - spent;

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.heading}>Budget</Text>
        {!editing && <Button label="Edit" variant="text" onPress={() => setEditing(true)} />}
      </View>

      <View style={styles.budgetHeadline}>
        <Text style={[styles.budgetBig, over && { color: colors.owe }]}>
          {over ? `Over by ${money(-remaining)}` : `${money(remaining)} left`}
        </Text>
        <Text style={styles.note}>{Math.round(pctUsed)}% used</Text>
      </View>

      <View
        style={styles.meter}
        accessibilityRole="progressbar"
        accessibilityLabel="Budget used"
        accessibilityValue={{ min: 0, max: 100, now: Math.min(100, Math.round(pctUsed)) }}
      >
        <View
          style={[
            styles.meterFill,
            { width: `${Math.min(100, pctUsed)}%`, backgroundColor: over ? colors.owe : colors.route },
          ]}
        />
      </View>

      <Text style={styles.note}>
        {money(spent)} spent of {money(budgetNum)}
        {!over && daysLeft != null && daysLeft > 0
          ? ` · about ${money(remaining / daysLeft)} a day ${
              started
                ? `for the ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`
                : `across the trip's ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`
            }`
          : ''}
      </Text>

      {editing && form}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/** A trip's expense report: headline numbers, budget, where the money went,
 *  spend per day, and what each member paid versus used. Who owes whom lives
 *  on the Balances tab; this links there rather than repeating it. Mirrors
 *  web's ReportTab. */
export function ReportTab({
  tripId,
  trip,
  expenses,
  memberNames,
  onChange,
  onGoToExpenses,
  onGoToBalances,
}: {
  tripId: string;
  trip: TripDetail;
  expenses: Expense[];
  memberNames: Record<string, string>;
  onChange: () => void;
  onGoToExpenses: () => void;
  onGoToBalances: () => void;
}) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const { currentUser } = useAuth();
  const [showBreakdown, setShowBreakdown] = useState(false);
  const currency = trip.currency;
  const money = (n: number) => formatMoney(n, currency);

  if (expenses.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No report yet</Text>
        <Text style={styles.note}>Log the first expense and this fills in with totals, budget and charts.</Text>
        <Button label="Log an expense" onPress={onGoToExpenses} style={{ alignSelf: 'flex-start', marginTop: 16 }} />
      </View>
    );
  }

  const memberIds = Object.keys(memberNames);
  const name = (id: string) => memberNames[id] ?? 'Former member';

  const paidByMember = new Map<string, number>();
  const shareByMember = new Map<string, number>();
  const totalByCategory = new Map<string, number>();
  // categoryByMember[category][userId] = that member's share of that category.
  const categoryByMember = new Map<string, Map<string, number>>();
  const expenseDays = new Set<string>();
  let settledTotal = 0;
  let outstandingTotal = 0;

  for (const expense of expenses) {
    const amount = Number(expense.amount);
    paidByMember.set(expense.paidById, (paidByMember.get(expense.paidById) ?? 0) + amount);
    totalByCategory.set(expense.category, (totalByCategory.get(expense.category) ?? 0) + amount);
    expenseDays.add(dateKey(expense.expenseDate));

    const categoryRow = categoryByMember.get(expense.category) ?? new Map<string, number>();
    categoryByMember.set(expense.category, categoryRow);
    for (const split of expense.splits) {
      const owed = Number(split.amountOwed);
      shareByMember.set(split.userId, (shareByMember.get(split.userId) ?? 0) + owed);
      categoryRow.set(split.userId, (categoryRow.get(split.userId) ?? 0) + owed);
      if (split.userId !== expense.paidById) {
        if (split.settled) settledTotal += owed;
        else outstandingTotal += owed;
      }
    }
  }

  const grandTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const sharedTotal = settledTotal + outstandingTotal;

  // Per day counts every trip day (plus any expense logged outside it), not just days with spending.
  const sortedExpenseDays = [...expenseDays].sort();
  const firstDay = [trip.startDate?.slice(0, 10), sortedExpenseDays[0]].filter(Boolean).sort()[0]!;
  const lastDay = [trip.endDate?.slice(0, 10), sortedExpenseDays[sortedExpenseDays.length - 1]]
    .filter(Boolean)
    .sort()
    .at(-1)!;
  const dayCount = dayRange(firstDay, lastDay).length;
  const perDay = grandTotal / dayCount;

  const today = new Date().toLocaleDateString('en-CA');
  const tripEnd = trip.endDate?.slice(0, 10);
  const tripStart = trip.startDate?.slice(0, 10);
  const daysLeft =
    tripStart && tripEnd && today <= tripEnd ? dayRange(today > tripStart ? today : tripStart, tripEnd).length : null;

  const categories = [...totalByCategory.entries()].sort((a, b) => b[1] - a[1]);
  const [topCategory, topCategoryAmount] = categories[0];
  const matrixCategories = EXPENSE_CATEGORIES.filter((cat) => categoryByMember.has(cat));

  const myShare = currentUser ? (shareByMember.get(currentUser.id) ?? 0) : null;
  const perPerson = grandTotal / (memberIds.length || 1);

  const memberRows = memberIds
    .map((id) => ({ id, paid: paidByMember.get(id) ?? 0, used: shareByMember.get(id) ?? 0 }))
    .sort((a, b) => b.paid - a.paid);
  const maxMember = Math.max(...memberRows.flatMap((r) => [r.paid, r.used]), 0.01);
  const barWidth = (value: number, max: number) => `${value > 0 ? Math.max((value / max) * 100, 1.5) : 0}%` as const;

  const tiles = [
    { value: money(grandTotal), label: `spent · ${expenses.length} ${expenses.length === 1 ? 'expense' : 'expenses'}` },
    { value: money(perDay), label: `per day · over ${dayCount} ${dayCount === 1 ? 'day' : 'days'}` },
    {
      value: money(myShare ?? perPerson),
      label: myShare != null ? `your share · avg ${money(perPerson)} each` : 'per person',
    },
    { value: topCategory, label: `top category · ${Math.round((topCategoryAmount / grandTotal) * 100)}% of spend` },
  ];

  return (
    <View>
      <View style={styles.tiles}>
        {tiles.map((t) => (
          <View key={t.label} style={styles.tile}>
            <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
              {t.value}
            </Text>
            <Text style={styles.tileLabel}>{t.label}</Text>
          </View>
        ))}
      </View>

      <BudgetCard
        key={trip.budget ?? 'none'}
        tripId={tripId}
        budget={trip.budget}
        spent={grandTotal}
        currency={currency}
        daysLeft={daysLeft}
        started={!tripStart || today >= tripStart}
        onChange={onChange}
      />

      <View style={styles.card}>
        <Text style={styles.heading}>Where the money went</Text>
        {categories.map(([cat, amount]) => (
          <View key={cat} style={styles.barRow}>
            <View style={styles.barHead}>
              <Text style={styles.barLabel}>{cat}</Text>
              <Text style={styles.amount}>
                {money(amount)} <Text style={styles.pct}>{Math.round((amount / grandTotal) * 100)}%</Text>
              </Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: barWidth(amount, topCategoryAmount) }]} />
            </View>
          </View>
        ))}

        <Button
          label={`${showBreakdown ? 'Hide' : 'Show'} per-member breakdown`}
          variant="text"
          onPress={() => setShowBreakdown((v) => !v)}
          style={{ alignSelf: 'flex-start', marginTop: 8 }}
        />

        {showBreakdown && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={styles.matrixRow}>
                  <Text style={[styles.matrixCell, styles.matrixHead, styles.matrixFirst]}>Category</Text>
                  {memberIds.map((id) => (
                    <Text key={id} style={[styles.matrixCell, styles.matrixHead]} numberOfLines={1}>
                      {name(id)}
                    </Text>
                  ))}
                  <Text style={[styles.matrixCell, styles.matrixHead]}>Total</Text>
                </View>
                {matrixCategories.map((cat) => {
                  const row = categoryByMember.get(cat)!;
                  return (
                    <View style={styles.matrixRow} key={cat}>
                      <Text style={[styles.matrixCell, styles.matrixFirst]}>{cat}</Text>
                      {memberIds.map((id) => {
                        const v = row.get(id) ?? 0;
                        return (
                          <Text key={id} style={styles.matrixCell}>
                            {v > 0 ? money(v) : '—'}
                          </Text>
                        );
                      })}
                      <Text style={[styles.matrixCell, styles.matrixTotal]}>{money(totalByCategory.get(cat) ?? 0)}</Text>
                    </View>
                  );
                })}
                <View style={[styles.matrixRow, styles.matrixFoot]}>
                  <Text style={[styles.matrixCell, styles.matrixTotal, styles.matrixFirst]}>Total</Text>
                  {memberIds.map((id) => (
                    <Text key={id} style={[styles.matrixCell, styles.matrixTotal]}>
                      {money(shareByMember.get(id) ?? 0)}
                    </Text>
                  ))}
                  <Text style={[styles.matrixCell, styles.matrixTotal]}>{money(grandTotal)}</Text>
                </View>
              </View>
            </ScrollView>
            <Text style={[styles.note, { marginTop: 8 }]}>Each member's share of each category.</Text>
          </>
        )}
      </View>

      <SpendOverTimeChart expenses={expenses} currency={currency} />

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.heading}>Paid vs. used</Text>
          <Button label="See who owes whom →" variant="text" onPress={onGoToBalances} />
        </View>
        <Text style={[styles.note, { marginBottom: 12 }]}>
          What each person paid for, next to their share of what was spent. The difference is what the Balances tab
          settles.
        </Text>
        {memberRows.map(({ id, paid, used }) => (
          <View key={id} style={styles.member}>
            <Text style={styles.memberName}>
              {name(id)}
              {id === currentUser?.id && <Text style={styles.you}> (you)</Text>}
            </Text>
            {(
              [
                ['Paid', paid, colors.route],
                ['Used', used, colors.ledger],
              ] as const
            ).map(([key, value, color]) => (
              <View key={key} style={styles.memberBar}>
                <Text style={styles.memberKey}>{key}</Text>
                <View style={[styles.track, { flex: 1 }]}>
                  <View style={[styles.fill, { width: barWidth(value, maxMember), backgroundColor: color }]} />
                </View>
                <Text style={[styles.amount, styles.memberAmount]}>{money(value)}</Text>
              </View>
            ))}
          </View>
        ))}

        {sharedTotal > 0.005 && (
          <View style={styles.settled}>
            <View style={styles.cardHead}>
              <Text style={styles.subheading}>Paid back so far</Text>
              <Text style={styles.note}>{Math.round((settledTotal / sharedTotal) * 100)}%</Text>
            </View>
            {settledTotal > 0.005 && (
              <View
                style={[styles.meter, styles.meterThin]}
                accessibilityRole="progressbar"
                accessibilityLabel="Paid back so far"
                accessibilityValue={{ min: 0, max: 100, now: Math.round((settledTotal / sharedTotal) * 100) }}
              >
                <View style={[styles.meterFill, { width: `${(settledTotal / sharedTotal) * 100}%` }]} />
              </View>
            )}
            <Text style={styles.note}>
              {settledTotal > 0.005
                ? `${money(settledTotal)} of ${money(sharedTotal)} paid back · ${money(outstandingTotal)} to go`
                : `Nothing paid back yet · ${money(outstandingTotal)} still owed between members`}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    emptyState: { paddingVertical: 32 },
    emptyTitle: { fontSize: typeScale.title2, fontWeight: '700', color: colors.ink, marginBottom: 6 },
    error: { color: colors.owe, fontSize: typeScale.footnote, marginTop: 8 },
    note: { fontSize: typeScale.footnote, lineHeight: 18, color: colors.inkSoft },

    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    tile: {
      flexGrow: 1,
      flexBasis: '45%',
      padding: 14,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
    },
    tileValue: {
      fontSize: typeScale.title2,
      fontWeight: '700',
      letterSpacing: -0.3,
      fontVariant: ['tabular-nums'],
      color: colors.ink,
    },
    tileLabel: { fontSize: typeScale.caption, color: colors.inkSoft, marginTop: 4 },

    card: { padding: 16, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: 16 },
    cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    heading: { fontSize: typeScale.body, fontWeight: '600', color: colors.ink, marginBottom: 10 },
    subheading: { fontSize: typeScale.subhead, fontWeight: '600', color: colors.ink },

    budgetHeadline: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
    budgetBig: {
      fontSize: typeScale.title2,
      fontWeight: '700',
      letterSpacing: -0.3,
      fontVariant: ['tabular-nums'],
      color: colors.ink,
    },
    budgetForm: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
    budgetInput: {
      flex: 1,
      minHeight: 44,
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radius.sm,
      paddingHorizontal: 12,
      backgroundColor: colors.bg,
      color: colors.ink,
      fontSize: typeScale.subhead,
    },
    meter: {
      height: 10,
      borderRadius: radius.pill,
      backgroundColor: colors.routeSoft,
      overflow: 'hidden',
      marginTop: 10,
      marginBottom: 8,
    },
    meterThin: { height: 6 },
    meterFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.route },

    barRow: { marginBottom: 12 },
    barHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 6 },
    barLabel: { flex: 1, fontSize: typeScale.subhead, color: colors.ink },
    amount: { fontSize: typeScale.footnote, fontWeight: '600', fontVariant: ['tabular-nums'], color: colors.ink },
    pct: { fontWeight: '400', color: colors.inkSoft },
    track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.routeSoft, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.route },

    matrixRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule },
    matrixFoot: { borderBottomWidth: 0 },
    matrixCell: {
      width: 104,
      paddingVertical: 8,
      paddingRight: 10,
      fontSize: typeScale.footnote,
      fontVariant: ['tabular-nums'],
      color: colors.ink,
    },
    matrixFirst: { width: 116 },
    matrixHead: { fontWeight: '600', color: colors.inkSoft },
    matrixTotal: { fontWeight: '600' },

    member: { marginBottom: 14 },
    memberName: { fontSize: typeScale.subhead, fontWeight: '600', color: colors.ink, marginBottom: 6 },
    you: { fontWeight: '400', color: colors.inkSoft },
    memberBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    memberKey: { width: 36, fontSize: typeScale.caption, color: colors.inkSoft },
    memberAmount: { minWidth: 96, textAlign: 'right' },

    settled: {
      marginTop: 6,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.rule,
    },
  });
}
