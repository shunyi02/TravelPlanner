import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatMoney, type Balance, type Settlement } from '@travel-planner/shared';
import { api } from '../api';
import { ArrowRight } from '../icons';
import { radius, typeScale, useTheme, type ThemeColors } from '../theme';

/** Who is up and who is down, then the fewest payments that settle the trip. */
export function BalancesTab({
  tripId,
  memberNames,
  currency,
  currentUserId,
}: {
  tripId: string;
  memberNames: Record<string, string>;
  currency: string;
  currentUserId?: string;
}) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const [balances, setBalances] = useState<Balance[] | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    Promise.all([api.getBalances(tripId), api.getSettlements(tripId)])
      .then(([b, s]) => {
        setBalances(b);
        setSettlements(s);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load balances'));
  }, [tripId]);

  const name = (id: string) => (id === currentUserId ? 'You' : (memberNames[id] ?? 'Former member'));
  const money = (n: number) => formatMoney(n, currency);

  if (error) return <Text style={styles.error}>Couldn't load balances: {error}</Text>;
  if (balances === null) return <Text style={styles.note}>Loading balances…</Text>;

  if (balances.length === 0) {
    return (
      <View>
        <Text style={styles.emptyTitle}>Nothing to settle</Text>
        <Text style={styles.note}>Once someone logs a shared expense, this shows who owes whom.</Text>
      </View>
    );
  }

  const sorted = [...balances].sort((a, b) => b.amount - a.amount);

  return (
    <View>
      <Text style={styles.heading}>Settle up</Text>
      {settlements.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.settledAll}>Everyone is square.</Text>
        </View>
      ) : (
        <View style={styles.card}>
          {settlements.map((s, i) => (
            <View key={i} style={[styles.payment, i < settlements.length - 1 && styles.divider]}>
              <Text style={styles.person} numberOfLines={1}>
                {name(s.fromUserId)}
              </Text>
              <ArrowRight size={14} color={colors.inkSoft} weight="bold" />
              <Text style={styles.person} numberOfLines={1}>
                {name(s.toUserId)}
              </Text>
              <Text style={styles.paymentAmount}>{money(s.amount)}</Text>
            </View>
          ))}
        </View>
      )}
      <Text style={styles.note}>The fewest payments that clear every balance.</Text>

      <Text style={[styles.heading, { marginTop: 24 }]}>Balances</Text>
      <View style={styles.card}>
        {sorted.map((b, i) => {
          const even = Math.abs(b.amount) < 0.005;
          const tone = even ? colors.inkSoft : b.amount > 0 ? colors.route : colors.owe;
          return (
            <View key={b.userId} style={[styles.row, i < sorted.length - 1 && styles.divider]}>
              <Text style={styles.rowTitle}>{name(b.userId)}</Text>
              <View style={styles.amountBox}>
                <Text style={[styles.amount, { color: tone }]}>{even ? 'Square' : money(Math.abs(b.amount))}</Text>
                {!even && (
                  <Text style={styles.amountLabel}>
                    {b.amount > 0 ? 'gets back' : b.userId === currentUserId ? 'owe' : 'owes'}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    error: { fontSize: typeScale.footnote, color: colors.owe },
    emptyTitle: { fontSize: typeScale.body, fontWeight: '600', color: colors.ink, marginBottom: 4 },
    heading: { fontSize: typeScale.footnote, fontWeight: '600', color: colors.inkSoft, marginBottom: 8 },
    note: { fontSize: typeScale.footnote, lineHeight: 18, color: colors.inkSoft, marginTop: 8 },
    card: { borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: 14 },
    divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule },
    payment: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 },
    person: { fontSize: typeScale.subhead, fontWeight: '600', color: colors.ink, maxWidth: '35%' },
    paymentAmount: { marginLeft: 'auto', fontSize: typeScale.subhead, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
    settledAll: { fontSize: typeScale.subhead, color: colors.route, fontWeight: '600', paddingVertical: 14 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
    rowTitle: { fontSize: typeScale.subhead, fontWeight: '500', color: colors.ink },
    amountBox: { alignItems: 'flex-end' },
    amount: { fontSize: typeScale.subhead, fontWeight: '600', fontVariant: ['tabular-nums'] },
    amountLabel: { fontSize: typeScale.caption, color: colors.inkSoft, marginTop: 1 },
  });
}
