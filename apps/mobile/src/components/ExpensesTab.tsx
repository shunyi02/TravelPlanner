import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { Expense } from '../api';
import { api } from '../api';
import { colors } from '../theme';

type SplitMode = 'even' | 'custom';

function evenAmounts(memberIds: string[], total: number): Record<string, string> {
  if (memberIds.length === 0) return {};
  const each = total / memberIds.length;
  return Object.fromEntries(memberIds.map((id) => [id, each ? each.toFixed(2) : '']));
}

function sumAmounts(amounts: Record<string, string>): number {
  return Object.values(amounts).reduce((sum, v) => sum + (Number(v) || 0), 0);
}

function toShares(amounts: Record<string, string>): Array<{ userId: string; share: number }> {
  const entries = Object.entries(amounts)
    .map(([userId, val]) => [userId, Number(val) || 0] as const)
    .filter(([, val]) => val > 0);
  const total = entries.reduce((sum, [, val]) => sum + val, 0);
  if (total <= 0) return [];
  return entries.map(([userId, val]) => ({ userId, share: val / total }));
}

function looksEven(expense: Expense, memberIds: string[]): boolean {
  if (expense.splits.length !== memberIds.length) return false;
  const values = expense.splits.map((s) => Number(s.amountOwed));
  return values.every((v) => Math.abs(v - values[0]) < 0.01);
}

function SplitEditor({
  memberIds,
  memberNames,
  total,
  mode,
  onModeChange,
  amounts,
  onAmountsChange,
}: {
  memberIds: string[];
  memberNames: Record<string, string>;
  total: number;
  mode: SplitMode;
  onModeChange: (mode: SplitMode) => void;
  amounts: Record<string, string>;
  onAmountsChange: (amounts: Record<string, string>) => void;
}) {
  const diff = total - sumAmounts(amounts);
  const balanced = Math.abs(diff) < 0.01;

  return (
    <View>
      <View style={styles.splitModeRow}>
        <Pressable style={styles.splitModeOption} onPress={() => onModeChange('even')}>
          <View style={[styles.radio, mode === 'even' && styles.radioActive]} />
          <Text style={styles.splitModeLabel}>Split evenly</Text>
        </Pressable>
        <Pressable
          style={styles.splitModeOption}
          onPress={() => {
            onModeChange('custom');
            if (Object.keys(amounts).length === 0) onAmountsChange(evenAmounts(memberIds, total));
          }}
        >
          <View style={[styles.radio, mode === 'custom' && styles.radioActive]} />
          <Text style={styles.splitModeLabel}>Custom amounts</Text>
        </Pressable>
      </View>
      {mode === 'custom' && (
        <View style={{ marginTop: 8, gap: 6 }}>
          {memberIds.map((id) => (
            <View style={styles.customSplitRow} key={id}>
              <Text style={styles.customSplitLabel}>{memberNames[id] ?? id}</Text>
              <TextInput
                style={styles.customSplitInput}
                keyboardType="decimal-pad"
                value={amounts[id] ?? ''}
                onChangeText={(v) => onAmountsChange({ ...amounts, [id]: v })}
              />
            </View>
          ))}
          <Text style={[styles.splitRemaining, { color: balanced ? colors.route : colors.owe }]}>
            {balanced
              ? 'Splits add up.'
              : diff > 0
                ? `${diff.toFixed(2)} left to assign`
                : `${Math.abs(diff).toFixed(2)} over`}
          </Text>
        </View>
      )}
    </View>
  );
}

function PayerPicker({
  memberIds,
  memberNames,
  value,
  onChange,
}: {
  memberIds: string[];
  memberNames: Record<string, string>;
  value: string;
  onChange: (userId: string) => void;
}) {
  return (
    <View>
      <Text style={styles.payerLabel}>Paid by</Text>
      <View style={styles.payerRow}>
        {memberIds.map((id) => (
          <Pressable
            key={id}
            style={[styles.payerChip, value === id && styles.payerChipActive]}
            onPress={() => onChange(id)}
          >
            <Text style={[styles.payerChipText, value === id && styles.payerChipTextActive]}>
              {memberNames[id] ?? id}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function ExpensesTab({
  tripId,
  expenses,
  memberNames,
  currency,
  currentUserId,
  onChange,
}: {
  tripId: string;
  expenses: Expense[];
  memberNames: Record<string, string>;
  currency: string;
  currentUserId?: string;
  onChange: () => void;
}) {
  const memberIds = Object.keys(memberNames);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidById, setPaidById] = useState(currentUserId ?? memberIds[0] ?? '');
  const [splitMode, setSplitMode] = useState<SplitMode>('even');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [showSplitEditor, setShowSplitEditor] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editPaidById, setEditPaidById] = useState('');
  const [editSplitMode, setEditSplitMode] = useState<SplitMode>('even');
  const [initialEditSplitMode, setInitialEditSplitMode] = useState<SplitMode>('even');
  const [editCustomAmounts, setEditCustomAmounts] = useState<Record<string, string>>({});
  const [showEditSplitEditor, setShowEditSplitEditor] = useState(false);

  const resetAddForm = () => {
    setDescription('');
    setAmount('');
    setPaidById(currentUserId ?? memberIds[0] ?? '');
    setSplitMode('even');
    setCustomAmounts({});
    setShowSplitEditor(false);
  };

  const handleAdd = async () => {
    setError(null);
    const parsed = Number(amount);
    if (!description.trim() || !parsed || parsed <= 0) return;

    let splits: Array<{ userId: string; share: number }> | undefined;
    if (showSplitEditor && splitMode === 'custom') {
      if (Math.abs(parsed - sumAmounts(customAmounts)) > 0.01) {
        setError('Custom amounts must add up to the total.');
        return;
      }
      splits = toShares(customAmounts);
    }

    try {
      await api.createExpense(tripId, { description: description.trim(), amount: parsed, paidById, splits });
      resetAddForm();
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log expense');
    }
  };

  const toggleExpand = (expenseId: string) => {
    setExpandedId(expandedId === expenseId ? null : expenseId);
    setEditingId(null);
    setError(null);
  };

  const startEdit = (expense: Expense) => {
    setExpandedId(expense.id);
    setEditingId(expense.id);
    setError(null);
    setEditDescription(expense.description);
    setEditAmount(expense.amount);
    setEditPaidById(expense.paidById);
    const mode: SplitMode = looksEven(expense, memberIds) ? 'even' : 'custom';
    setEditSplitMode(mode);
    setInitialEditSplitMode(mode);
    setEditCustomAmounts(Object.fromEntries(expense.splits.map((s) => [s.userId, s.amountOwed])));
    setShowEditSplitEditor(mode === 'custom');
  };

  const handleSaveEdit = async (expense: Expense) => {
    setError(null);
    const parsedAmount = Number(editAmount);
    if (!editDescription.trim() || !parsedAmount || parsedAmount <= 0) return;

    const data: {
      description?: string;
      amount?: number;
      paidById?: string;
      splits?: Array<{ userId: string; share: number }>;
    } = {};
    if (editDescription.trim() !== expense.description) data.description = editDescription.trim();
    if (parsedAmount !== Number(expense.amount)) data.amount = parsedAmount;
    if (editPaidById !== expense.paidById) data.paidById = editPaidById;

    if (showEditSplitEditor && editSplitMode === 'custom') {
      if (Math.abs(parsedAmount - sumAmounts(editCustomAmounts)) > 0.01) {
        setError('Custom amounts must add up to the total.');
        return;
      }
      data.splits = toShares(editCustomAmounts);
    } else if (initialEditSplitMode === 'custom') {
      data.splits = memberIds.map((id) => ({ userId: id, share: 1 / memberIds.length }));
    }

    try {
      await api.updateExpense(tripId, expense.id, data);
      setEditingId(null);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save expense');
    }
  };

  const handleDelete = (expense: Expense) => {
    Alert.alert('Delete expense', `Delete "${expense.description}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteExpense(tripId, expense.id);
            if (expandedId === expense.id) setExpandedId(null);
            onChange();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not delete expense');
          }
        },
      },
    ]);
  };

  const handleToggleSettled = async (expense: Expense, splitUserId: string, settled: boolean) => {
    try {
      await api.setSplitSettled(tripId, expense.id, splitUserId, settled);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update settlement');
    }
  };

  return (
    <View>
      {expenses.length === 0 ? (
        <Text style={styles.empty}>No expenses logged yet.</Text>
      ) : (
        expenses.map((expense) => (
          <View key={expense.id}>
            <Pressable style={styles.row} onPress={() => toggleExpand(expense.id)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{expense.description}</Text>
                <Text style={styles.rowSub}>paid by {memberNames[expense.paidById] ?? 'someone'}</Text>
              </View>
              <Text style={styles.amount}>
                {expense.currency} {expense.amount}
              </Text>
            </Pressable>

            {expandedId === expense.id && editingId !== expense.id && (
              <View style={styles.breakdown}>
                {expense.splits.filter((s) => s.userId !== expense.paidById).length === 0 ? (
                  <Text style={styles.splitItemLabel}>Nobody else owes anything on this one.</Text>
                ) : (
                  expense.splits
                    .filter((s) => s.userId !== expense.paidById)
                    .map((s) => (
                      <View style={styles.splitItem} key={s.userId}>
                        <Text style={styles.splitItemLabel}>
                          {memberNames[s.userId] ?? s.userId} owes {expense.currency} {s.amountOwed}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.splitItemLabel}>{s.settled ? 'Settled' : 'Not settled'}</Text>
                          <Switch
                            value={s.settled}
                            onValueChange={(v) => handleToggleSettled(expense, s.userId, v)}
                          />
                        </View>
                      </View>
                    ))
                )}
                <View style={styles.rowActions}>
                  <Pressable onPress={() => startEdit(expense)}>
                    <Text style={styles.textBtn}>Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => handleDelete(expense)}>
                    <Text style={[styles.textBtn, { color: colors.owe }]}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {editingId === expense.id && (
              <View style={styles.breakdown}>
                <TextInput
                  style={styles.input}
                  placeholder="Name"
                  placeholderTextColor={colors.inkSoft}
                  value={editDescription}
                  onChangeText={setEditDescription}
                />
                <TextInput
                  style={[styles.input, { maxWidth: 140 }]}
                  placeholder={`Amount (${currency})`}
                  placeholderTextColor={colors.inkSoft}
                  keyboardType="decimal-pad"
                  value={editAmount}
                  onChangeText={setEditAmount}
                />
                <PayerPicker memberIds={memberIds} memberNames={memberNames} value={editPaidById} onChange={setEditPaidById} />
                <Pressable onPress={() => setShowEditSplitEditor((v) => !v)}>
                  <Text style={styles.textBtn}>{showEditSplitEditor ? 'Hide split options' : 'Split options'}</Text>
                </Pressable>
                {showEditSplitEditor && (
                  <SplitEditor
                    memberIds={memberIds}
                    memberNames={memberNames}
                    total={Number(editAmount) || 0}
                    mode={editSplitMode}
                    onModeChange={setEditSplitMode}
                    amounts={editCustomAmounts}
                    onAmountsChange={setEditCustomAmounts}
                  />
                )}
                <View style={styles.rowActions}>
                  <Pressable style={styles.button} onPress={() => handleSaveEdit(expense)}>
                    <Text style={styles.buttonText}>Save</Text>
                  </Pressable>
                  <Pressable style={styles.buttonOutline} onPress={() => setEditingId(null)}>
                    <Text style={[styles.buttonText, { color: colors.route }]}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        ))
      )}

      <View style={{ marginTop: 16 }}>
        <View style={styles.form}>
          <TextInput
            style={[styles.input, { flex: 2 }]}
            placeholder="Name"
            placeholderTextColor={colors.inkSoft}
            value={description}
            onChangeText={setDescription}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder={`Amount (${currency})`}
            placeholderTextColor={colors.inkSoft}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />
        </View>
        <PayerPicker memberIds={memberIds} memberNames={memberNames} value={paidById} onChange={setPaidById} />
        <Pressable onPress={() => setShowSplitEditor((v) => !v)} style={{ marginTop: 8 }}>
          <Text style={styles.textBtn}>
            {showSplitEditor ? 'Hide split options' : 'Split options (defaults to evenly)'}
          </Text>
        </Pressable>
        {showSplitEditor && (
          <SplitEditor
            memberIds={memberIds}
            memberNames={memberNames}
            total={Number(amount) || 0}
            mode={splitMode}
            onModeChange={setSplitMode}
            amounts={customAmounts}
            onAmountsChange={setCustomAmounts}
          />
        )}
        {error && <Text style={{ color: colors.owe, marginTop: 8 }}>{error}</Text>}
        <Pressable style={styles.button} onPress={handleAdd}>
          <Text style={styles.buttonText}>Log expense</Text>
        </Pressable>
      </View>
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
  breakdown: {
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.rule,
    marginVertical: 8,
    gap: 8,
  },
  splitItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  splitItemLabel: { fontSize: 13, color: colors.inkSoft, flex: 1 },
  rowActions: { flexDirection: 'row', gap: 16, marginTop: 4 },
  textBtn: { color: colors.route, fontSize: 13, fontWeight: '500' },
  form: { flexDirection: 'row', gap: 8 },
  payerLabel: { fontSize: 12, color: colors.inkSoft, marginTop: 10, marginBottom: 6 },
  payerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  payerChip: {
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  payerChipActive: { backgroundColor: colors.route, borderColor: colors.route },
  payerChipText: { fontSize: 13, color: colors.ink },
  payerChipTextActive: { color: '#fff' },
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
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonOutline: {
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  splitModeRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  splitModeOption: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  splitModeLabel: { fontSize: 13, color: colors.inkSoft },
  radio: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.rule },
  radioActive: { backgroundColor: colors.route, borderColor: colors.route },
  customSplitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  customSplitLabel: { fontSize: 13, color: colors.ink },
  customSplitInput: {
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    width: 90,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  splitRemaining: { fontSize: 12 },
});
