import { useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { EXPENSE_CATEGORIES, DEFAULT_EXPENSE_CATEGORY } from '@travel-planner/shared';
import type { Expense } from '../api';
import { api } from '../api';
import { radius, typeScale, useTheme, type ThemeColors } from '../theme';
import { Button } from './Button';
import { useDialog } from './Dialog';
import { Tappable } from './Tappable';

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
  const colors = useTheme();
  const styles = createStyles(colors);
  const diff = total - sumAmounts(amounts);
  const balanced = Math.abs(diff) < 0.01;

  return (
    <View>
      <View style={styles.splitModeRow}>
        <Tappable style={styles.splitModeOption} onPress={() => onModeChange('even')}>
          <View style={[styles.radio, mode === 'even' && styles.radioActive]} />
          <Text style={styles.splitModeLabel}>Split evenly</Text>
        </Tappable>
        <Tappable
          style={styles.splitModeOption}
          onPress={() => {
            onModeChange('custom');
            if (Object.keys(amounts).length === 0) onAmountsChange(evenAmounts(memberIds, total));
          }}
        >
          <View style={[styles.radio, mode === 'custom' && styles.radioActive]} />
          <Text style={styles.splitModeLabel}>Custom amounts</Text>
        </Tappable>
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
  const colors = useTheme();
  const styles = createStyles(colors);
  return (
    <View>
      <Text style={styles.payerLabel}>Paid by</Text>
      <View style={styles.payerRow}>
        {memberIds.map((id) => (
          <Tappable
            key={id}
            style={[styles.payerChip, value === id && styles.payerChipActive]}
            onPress={() => onChange(id)}
          >
            <Text style={[styles.payerChipText, value === id && styles.payerChipTextActive]}>
              {memberNames[id] ?? id}
            </Text>
          </Tappable>
        ))}
      </View>
    </View>
  );
}

function CategoryPicker({ value, onChange }: { value: string; onChange: (category: string) => void }) {
  const colors = useTheme();
  const styles = createStyles(colors);
  return (
    <View>
      <Text style={styles.payerLabel}>Category</Text>
      <View style={styles.payerRow}>
        {EXPENSE_CATEGORIES.map((cat) => (
          <Tappable
            key={cat}
            style={[styles.payerChip, value === cat && styles.payerChipActive]}
            onPress={() => onChange(cat)}
          >
            <Text style={[styles.payerChipText, value === cat && styles.payerChipTextActive]}>{cat}</Text>
          </Tappable>
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
  const colors = useTheme();
  const showDialog = useDialog();
  const styles = createStyles(colors);
  const memberIds = Object.keys(memberNames);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidById, setPaidById] = useState(currentUserId ?? memberIds[0] ?? '');
  const [category, setCategory] = useState<string>(DEFAULT_EXPENSE_CATEGORY);
  const [splitMode, setSplitMode] = useState<SplitMode>('even');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [showSplitEditor, setShowSplitEditor] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editPaidById, setEditPaidById] = useState('');
  const [editCategory, setEditCategory] = useState<string>(DEFAULT_EXPENSE_CATEGORY);
  const [editSplitMode, setEditSplitMode] = useState<SplitMode>('even');
  const [initialEditSplitMode, setInitialEditSplitMode] = useState<SplitMode>('even');
  const [editCustomAmounts, setEditCustomAmounts] = useState<Record<string, string>>({});
  const [showEditSplitEditor, setShowEditSplitEditor] = useState(false);

  const resetAddForm = () => {
    setDescription('');
    setAmount('');
    setPaidById(currentUserId ?? memberIds[0] ?? '');
    setCategory(DEFAULT_EXPENSE_CATEGORY);
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
      await api.createExpense(tripId, { description: description.trim(), amount: parsed, paidById, category, splits });
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
    setEditCategory(expense.category);
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
      category?: string;
      splits?: Array<{ userId: string; share: number }>;
    } = {};
    if (editDescription.trim() !== expense.description) data.description = editDescription.trim();
    if (parsedAmount !== Number(expense.amount)) data.amount = parsedAmount;
    if (editPaidById !== expense.paidById) data.paidById = editPaidById;
    if (editCategory !== expense.category) data.category = editCategory;

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
    showDialog({
      title: 'Delete expense',
      message: `Delete "${expense.description}"? This can't be undone.`,
      actions: [
        {
          label: 'Delete',
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
        { label: 'Cancel', style: 'cancel' },
      ],
    });
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
            <Tappable style={styles.row} onPress={() => toggleExpand(expense.id)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{expense.description}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <Text style={styles.rowSub}>paid by {memberNames[expense.paidById] ?? 'someone'}</Text>
                  <View style={styles.categoryChip}>
                    <Text style={styles.categoryChipText}>{expense.category}</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.amount}>
                {expense.currency} {expense.amount}
              </Text>
            </Tappable>

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
                  <Button label="Edit" variant="text" onPress={() => startEdit(expense)} />
                  <Button label="Delete" variant="text" tone="danger" onPress={() => handleDelete(expense)} />
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
                <CategoryPicker value={editCategory} onChange={setEditCategory} />
                <Button
                  label={showEditSplitEditor ? 'Hide split options' : 'Split options'}
                  variant="text"
                  onPress={() => setShowEditSplitEditor((v) => !v)}
                  style={styles.textAction}
                />
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
                  <Button label="Save" onPress={() => handleSaveEdit(expense)} style={styles.formButton} />
                  <Button label="Cancel" variant="secondary" onPress={() => setEditingId(null)} style={styles.formButton} />
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
        <CategoryPicker value={category} onChange={setCategory} />
        <Button
          label={showSplitEditor ? 'Hide split options' : 'Split options (defaults to evenly)'}
          variant="text"
          onPress={() => setShowSplitEditor((v) => !v)}
          style={[styles.textAction, { marginTop: 8 }]}
        />
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
        <Button label="Log expense" onPress={handleAdd} style={styles.formButton} />
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    empty: { color: colors.inkSoft, paddingVertical: 16 },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.rule,
    },
    rowTitle: { fontSize: typeScale.subhead, fontWeight: '500', color: colors.ink },
    rowSub: { fontSize: typeScale.caption, color: colors.inkSoft },
    categoryChip: {
      backgroundColor: colors.ledgerSoft,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    categoryChipText: { fontSize: typeScale.caption, color: colors.inkSoft },
    amount: { fontVariant: ['tabular-nums'], color: colors.ink },
    breakdown: {
      paddingLeft: 12,
      borderLeftWidth: 2,
      borderLeftColor: colors.rule,
      marginVertical: 8,
      gap: 8,
    },
    splitItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    splitItemLabel: { fontSize: typeScale.footnote, color: colors.inkSoft, flex: 1 },
    rowActions: { flexDirection: 'row', gap: 16, marginTop: 4 },
    textAction: { alignSelf: 'flex-start' },
    form: { flexDirection: 'row', gap: 8 },
    payerLabel: { fontSize: typeScale.caption, color: colors.inkSoft, marginTop: 10, marginBottom: 6 },
    payerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    payerChip: {
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radius.md,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    payerChipActive: { backgroundColor: colors.route, borderColor: colors.route },
    payerChipText: { fontSize: typeScale.footnote, color: colors.ink },
    payerChipTextActive: { color: colors.onRoute },
    input: {
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      color: colors.ink,
    },
    formButton: { marginTop: 10 },
    splitModeRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
    splitModeOption: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    splitModeLabel: { fontSize: typeScale.footnote, color: colors.inkSoft },
    radio: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.rule },
    radioActive: { backgroundColor: colors.route, borderColor: colors.route },
    customSplitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    customSplitLabel: { fontSize: typeScale.footnote, color: colors.ink },
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
    splitRemaining: { fontSize: typeScale.caption },
  });
}
