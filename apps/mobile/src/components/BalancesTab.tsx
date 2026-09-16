import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Balance, Settlement } from '@travel-planner/shared';
import { api } from '../api';
import { colors } from '../theme';

export function BalancesTab({ tripId, memberNames }: { tripId: string; memberNames: Record<string, string> }) {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    Promise.all([api.getBalances(tripId), api.getSettlements(tripId)])
      .then(([b, s]) => {
        setBalances(b);
        setSettlements(s);
      })
      .catch((err) => setError(err.message));
  }, [tripId]);

  const name = (id: string) => memberNames[id] ?? id;

  if (error) return <Text style={styles.empty}>Couldn't load balances: {error}</Text>;

  return (
    <View>
      {balances.length === 0 ? (
        <Text style={styles.empty}>No expenses to settle yet.</Text>
      ) : (
        balances.map((b) => (
          <View style={styles.row} key={b.userId}>
            <Text style={styles.rowTitle}>{name(b.userId)}</Text>
            <Text style={[styles.amount, { color: b.amount >= 0 ? colors.route : colors.owe }]}>
              {b.amount >= 0 ? 'is owed ' : 'owes '}
              {Math.abs(b.amount).toFixed(2)}
            </Text>
          </View>
        ))
      )}

      {settlements.length > 0 && (
        <View style={styles.settlementNote}>
          {settlements.map((s, i) => (
            <Text key={i} style={styles.settlementLine}>
              {name(s.fromUserId)} pays {name(s.toUserId)} {s.amount.toFixed(2)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.inkSoft, paddingVertical: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  rowTitle: { fontSize: 15, fontWeight: '500', color: colors.ink },
  amount: { fontVariant: ['tabular-nums'] },
  settlementNote: {
    backgroundColor: colors.ledgerSoft,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 6,
    padding: 14,
    marginTop: 12,
    gap: 4,
  },
  settlementLine: { color: colors.ink },
});
