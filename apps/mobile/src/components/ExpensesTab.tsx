import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Expense } from '../api';
import { api } from '../api';
import { colors } from '../theme';

export function ExpensesTab({
  tripId,
  expenses,
  memberNames,
  onChange,
}: {
  tripId: string;
  expenses: Expense[];
  memberNames: Record<string, string>;
  onChange: () => void;
}) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  const handleAdd = async () => {
    const parsed = Number(amount);
    if (!description.trim() || !parsed || parsed <= 0) return;
    // Splits evenly across all trip members by default, same as the web app.
    // Custom per-person shares are supported by the API but not yet exposed here.
    await api.createExpense(tripId, { description: description.trim(), amount: parsed });
    setDescription('');
    setAmount('');
    onChange();
  };

  return (
    <View>
      {expenses.length === 0 ? (
        <Text style={styles.empty}>No expenses logged yet.</Text>
      ) : (
        expenses.map((expense) => (
          <View style={styles.row} key={expense.id}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{expense.description}</Text>
              <Text style={styles.rowSub}>paid by {memberNames[expense.paidById] ?? 'someone'}</Text>
            </View>
            <Text style={styles.amount}>
              {expense.currency} {expense.amount}
            </Text>
          </View>
        ))
      )}

      <View style={styles.form}>
        <TextInput
          style={[styles.input, { flex: 2 }]}
          placeholder="What was it for?"
          placeholderTextColor={colors.inkSoft}
          value={description}
          onChangeText={setDescription}
        />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Amount"
          placeholderTextColor={colors.inkSoft}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
      </View>
      <Pressable style={styles.button} onPress={handleAdd}>
        <Text style={styles.buttonText}>Log expense</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.inkSoft, paddingVertical: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  rowTitle: { fontSize: 15, fontWeight: '500', color: colors.ink },
  rowSub: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  amount: { fontVariant: ['tabular-nums'], color: colors.ink },
  form: { flexDirection: 'row', gap: 8, marginTop: 16 },
  input: {
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
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});
