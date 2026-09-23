import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Balance } from '@travel-planner/shared';
import { EXPENSE_CATEGORIES } from '@travel-planner/shared';
import type { Expense, TripDetail } from '../api';
import { api } from '../api';
import { hueForIndex } from '../palette';
import { PieChart, type PieSlice } from './PieChart';
import { SpendOverTimeChart } from './SpendOverTimeChart';
import { useTheme, type ThemeColors } from '../theme';

function BudgetCard({
  tripId,
  budget,
  spent,
  currency,
  onChange,
}: {
  tripId: string;
  budget: string | null;
  spent: number;
  currency: string;
  onChange: () => void;
}) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const [input, setInput] = useState(budget ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const parsed = input.trim() === '' ? null : Number(input);
      if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
        setError('Enter a valid amount, or leave blank to clear the budget.');
        return;
      }
      await api.updateTrip(tripId, { budget: parsed });
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save budget');
    } finally {
      setSaving(false);
    }
  };

  const budgetNum = budget != null ? Number(budget) : null;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionLabel}>Budget</Text>
      {budgetNum != null ? (
        <>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${Math.min(100, (spent / budgetNum) * 100)}%`, backgroundColor: spent > budgetNum ? colors.owe : colors.route },
              ]}
            />
          </View>
          <Text style={styles.budgetLine}>
            {currency} {spent.toFixed(2)} spent of {currency} {budgetNum.toFixed(2)}
            {spent > budgetNum
              ? ` · ${currency} ${(spent - budgetNum).toFixed(2)} over`
              : ` · ${currency} ${(budgetNum - spent).toFixed(2)} left`}
          </Text>
        </>
      ) : (
        <Text style={styles.empty}>No budget set for this trip.</Text>
      )}
      <View style={[styles.formInline, { marginTop: budgetNum != null ? 12 : 0 }]}>
        <TextInput
          style={styles.budgetInput}
          keyboardType="decimal-pad"
          placeholder={`Budget (${currency})`}
          placeholderTextColor={colors.inkSoft}
          value={input}
          onChangeText={setInput}
        />
        <Pressable style={styles.buttonOutline} onPress={handleSave} disabled={saving}>
          <Text style={[styles.buttonText, { color: colors.route }]}>{budgetNum != null ? 'Update' : 'Set budget'}</Text>
        </Pressable>
      </View>
      {error && <Text style={{ color: colors.owe, marginTop: 8 }}>{error}</Text>}
    </View>
  );
}

/** Full expense report for a trip: totals, budget tracking, a per-member
 *  breakdown, a category × member matrix, settlement progress, and spend
 *  over time. Net balances come from the same endpoint as the Balances
 *  tab, so the two never disagree about who owes what. */
export function ReportTab({
  tripId,
  trip,
  expenses,
  memberNames,
  onChange,
}: {
  tripId: string;
  trip: TripDetail;
  expenses: Expense[];
  memberNames: Record<string, string>;
  onChange: () => void;
}) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const currency = trip.currency;
  const [balances, setBalances] = useState<Balance[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    api
      .getBalances(tripId)
      .then(setBalances)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load balances'));
  }, [tripId]);

  const memberIds = Object.keys(memberNames);

  if (expenses.length === 0) {
    return <Text style={styles.empty}>No expenses logged yet — nothing to report.</Text>;
  }

  const netByMember = new Map(balances.map((b) => [b.userId, b.amount]));
  const paidByMember = new Map<string, number>();
  const paidCountByMember = new Map<string, number>();
  const shareByMember = new Map<string, number>();
  const categoryByMember = new Map<string, Map<string, number>>();
  let settledTotal = 0;
  let outstandingTotal = 0;

  for (const expense of expenses) {
    const amount = Number(expense.amount);
    paidByMember.set(expense.paidById, (paidByMember.get(expense.paidById) ?? 0) + amount);
    paidCountByMember.set(expense.paidById, (paidCountByMember.get(expense.paidById) ?? 0) + 1);

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
  const categoriesPresent = EXPENSE_CATEGORIES.filter((cat) => categoryByMember.has(cat));

  const memberSlices: PieSlice[] = memberIds
    .map((id, i) => ({
      key: id,
      label: memberNames[id] ?? id,
      amount: paidByMember.get(id) ?? 0,
      color: hueForIndex(i),
    }))
    .filter((s) => s.amount > 0);

  return (
    <View>
      <View style={styles.summary}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {currency} {grandTotal.toFixed(2)}
          </Text>
          <Text style={styles.statLabel}>Total spend</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{expenses.length}</Text>
          <Text style={styles.statLabel}>Expenses logged</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {currency} {(grandTotal / (memberIds.length || 1)).toFixed(2)}
          </Text>
          <Text style={styles.statLabel}>Average share per member</Text>
        </View>
      </View>

      <BudgetCard tripId={tripId} budget={trip.budget} spent={grandTotal} currency={currency} onChange={onChange} />

      <Text style={styles.sectionLabel}>By member</Text>
      {error && <Text style={styles.empty}>Couldn't load balances: {error}</Text>}
      <View style={styles.card}>
        {memberIds.map((id) => {
          const paid = paidByMember.get(id) ?? 0;
          const paidCount = paidCountByMember.get(id) ?? 0;
          const share = shareByMember.get(id) ?? 0;
          const net = netByMember.get(id) ?? 0;
          return (
            <View style={styles.memberRow} key={id}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{memberNames[id] ?? id}</Text>
                <Text style={styles.rowSub}>
                  paid {currency} {paid.toFixed(2)} ({paidCount} expense{paidCount === 1 ? '' : 's'}) · share {currency}{' '}
                  {share.toFixed(2)}
                </Text>
              </View>
              <Text style={[styles.amount, { color: net > 0 ? colors.route : net < 0 ? colors.owe : colors.inkSoft }]}>
                {Math.abs(net) < 0.005
                  ? 'settled up'
                  : `${net > 0 ? 'is owed ' : 'owes '}${currency} ${Math.abs(net).toFixed(2)}`}
              </Text>
            </View>
          );
        })}
      </View>

      {sharedTotal > 0.005 && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Settlement status</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${(settledTotal / sharedTotal) * 100}%`, backgroundColor: colors.route }]} />
          </View>
          <Text style={styles.budgetLine}>
            {currency} {settledTotal.toFixed(2)} settled of {currency} {sharedTotal.toFixed(2)} owed between members
            {' · '}
            {currency} {outstandingTotal.toFixed(2)} outstanding
          </Text>
        </View>
      )}

      {categoriesPresent.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>By category &amp; member</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={styles.matrixRow}>
                <Text style={[styles.matrixCell, styles.matrixHeaderCell, { width: 110 }]}>Category</Text>
                {memberIds.map((id) => (
                  <Text key={id} style={[styles.matrixCell, styles.matrixHeaderCell]}>
                    {memberNames[id] ?? id}
                  </Text>
                ))}
                <Text style={[styles.matrixCell, styles.matrixHeaderCell]}>Total</Text>
              </View>
              {categoriesPresent.map((cat) => {
                const row = categoryByMember.get(cat)!;
                const rowTotal = [...row.values()].reduce((sum, v) => sum + v, 0);
                return (
                  <View style={styles.matrixRow} key={cat}>
                    <Text style={[styles.matrixCell, { width: 110 }]}>{cat}</Text>
                    {memberIds.map((id) => (
                      <Text key={id} style={styles.matrixCell}>
                        {(row.get(id) ?? 0) > 0 ? (row.get(id) ?? 0).toFixed(2) : '—'}
                      </Text>
                    ))}
                    <Text style={[styles.matrixCell, styles.matrixTotalCell]}>{rowTotal.toFixed(2)}</Text>
                  </View>
                );
              })}
              <View style={styles.matrixRow}>
                <Text style={[styles.matrixCell, styles.matrixTotalCell, { width: 110 }]}>Total</Text>
                {memberIds.map((id) => (
                  <Text key={id} style={[styles.matrixCell, styles.matrixTotalCell]}>
                    {(shareByMember.get(id) ?? 0).toFixed(2)}
                  </Text>
                ))}
                <Text style={[styles.matrixCell, styles.matrixTotalCell]}>{grandTotal.toFixed(2)}</Text>
              </View>
            </View>
          </ScrollView>
          <Text style={styles.matrixNote}>Amounts are each member's share of that category, in {currency}.</Text>
        </View>
      )}

      <PieChart title="Paid by member" slices={memberSlices} currency={currency} />

      <SpendOverTimeChart expenses={expenses} currency={currency} />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
    stat: {
      flex: 1,
      minWidth: 100,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: 8,
      padding: 12,
    },
    statValue: { fontSize: 16, fontWeight: '700', color: colors.ink },
    statLabel: { fontSize: 11, color: colors.inkSoft, marginTop: 4 },
    sectionLabel: { fontSize: 13, color: colors.inkSoft, marginTop: 16, marginBottom: 8 },
    empty: { color: colors.inkSoft, paddingVertical: 8 },
    card: {
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: 8,
      padding: 14,
      backgroundColor: colors.surface,
      marginBottom: 4,
    },
    barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.routeSoft, overflow: 'hidden' },
    barFill: { height: 8, borderRadius: 4 },
    budgetLine: { fontSize: 12, color: colors.inkSoft, marginTop: 8 },
    formInline: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    budgetInput: {
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.bg,
      color: colors.ink,
      width: 140,
    },
    buttonOutline: { borderRadius: 6, paddingVertical: 8, paddingHorizontal: 14 },
    buttonText: { fontWeight: '600' },
    memberRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.rule,
    },
    rowTitle: { fontSize: 14, fontWeight: '500', color: colors.ink },
    rowSub: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
    amount: { fontVariant: ['tabular-nums'], fontSize: 13 },
    matrixRow: { flexDirection: 'row' },
    matrixCell: { width: 80, fontSize: 12, color: colors.ink, paddingVertical: 6, paddingRight: 8 },
    matrixHeaderCell: { fontWeight: '600', color: colors.inkSoft },
    matrixTotalCell: { fontWeight: '700', color: colors.ink },
    matrixNote: { fontSize: 11, color: colors.inkSoft, marginTop: 8 },
  });
}
