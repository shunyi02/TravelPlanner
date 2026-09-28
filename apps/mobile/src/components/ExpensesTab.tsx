import { useEffect, useRef, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CATEGORICAL_HUES,
  DEFAULT_EXPENSE_CATEGORY,
  EXPENSE_CATEGORIES,
  NEUTRAL_HUE,
  formatMoney,
} from '@travel-planner/shared';
import type { Expense } from '../api';
import { api } from '../api';
import { Bed, Compass, ForkKnife, MagnifyingGlass, Receipt, ShoppingBag, Ticket, Train } from '../icons';
import { radius, typeScale, useTheme, type ThemeColors } from '../theme';
import { Button } from './Button';
import { Field, TextField } from './Field';
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

/** The local calendar day of an ISO timestamp ("YYYY-MM-DD"). */
function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA');
}

/** "Wed, 30 Sep" for a day group. */
function dayHeading(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  const colors = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <Tappable
            key={o.id}
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={() => onChange(o.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{o.label}</Text>
          </Tappable>
        );
      })}
    </View>
  );
}

/** Add or edit one expense, in a sheet. With `initial` it edits and sends only
 *  what changed; switching a custom split back to even sends even shares. */
function ExpenseForm({
  tripId,
  initial,
  memberNames,
  currency,
  currentUserId,
  onCancel,
  onSaved,
}: {
  tripId: string;
  initial?: Expense;
  memberNames: Record<string, string>;
  currency: string;
  currentUserId?: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const memberIds = Object.keys(memberNames);
  const initialMode: SplitMode = initial && !looksEven(initial, memberIds) ? 'custom' : 'even';

  const [description, setDescription] = useState(initial?.description ?? '');
  const [amount, setAmount] = useState(initial?.amount ?? '');
  const [paidById, setPaidById] = useState(initial?.paidById ?? currentUserId ?? memberIds[0] ?? '');
  const [category, setCategory] = useState<string>(initial?.category ?? DEFAULT_EXPENSE_CATEGORY);
  const [splitMode, setSplitMode] = useState<SplitMode>(initialMode);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(
    initial ? Object.fromEntries(initial.splits.map((s) => [s.userId, s.amountOwed])) : {},
  );
  const [errors, setErrors] = useState<{ description?: string; amount?: string; split?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);

  const total = Number(amount) || 0;
  const diff = total - sumAmounts(customAmounts);
  const balanced = Math.abs(diff) < 0.01;

  const handleSave = async () => {
    const next: typeof errors = {};
    if (!description.trim()) next.description = 'Say what it was for.';
    if (!total || total <= 0) next.amount = 'Enter an amount above zero.';
    if (splitMode === 'custom' && !next.amount && !balanced) next.split = 'The split has to add up to the total.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      if (initial) {
        const data: {
          description?: string;
          amount?: number;
          paidById?: string;
          category?: string;
          splits?: Array<{ userId: string; share: number }>;
        } = {};
        if (description.trim() !== initial.description) data.description = description.trim();
        if (total !== Number(initial.amount)) data.amount = total;
        if (paidById !== initial.paidById) data.paidById = paidById;
        if (category !== initial.category) data.category = category;
        if (splitMode === 'custom') data.splits = toShares(customAmounts);
        else if (initialMode === 'custom') data.splits = memberIds.map((id) => ({ userId: id, share: 1 / memberIds.length }));
        await api.updateExpense(tripId, initial.id, data);
      } else {
        await api.createExpense(tripId, {
          description: description.trim(),
          amount: total,
          paidById,
          category,
          splits: splitMode === 'custom' ? toShares(customAmounts) : undefined,
        });
      }
      onSaved();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Could not save the expense' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHead}>
        <Button label="Cancel" variant="text" onPress={onCancel} />
        <Text style={styles.sheetTitle}>{initial ? 'Edit expense' : 'New expense'}</Text>
        <Button label={saving ? 'Saving…' : 'Save'} variant="text" onPress={handleSave} disabled={saving} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.sheetBody, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Field label={`Amount (${currency})`} error={errors.amount}>
          <TextInput
            style={[styles.bigAmount, !!errors.amount && { borderBottomColor: colors.owe }]}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.rule}
            value={amount}
            onChangeText={setAmount}
            accessibilityLabel={`Amount in ${currency}`}
            autoFocus={!initial}
          />
        </Field>
        <TextField
          label="What for"
          placeholder="e.g. Dinner at Jalan Alor"
          value={description}
          onChangeText={setDescription}
          error={errors.description}
        />
        <Field label="Paid by">
          <Chips
            label="Paid by"
            options={memberIds.map((id) => ({ id, label: id === currentUserId ? 'You' : (memberNames[id] ?? 'Former member') }))}
            value={paidById}
            onChange={setPaidById}
          />
        </Field>
        <Field label="Category">
          <Chips
            label="Category"
            options={EXPENSE_CATEGORIES.map((c) => ({ id: c as string, label: c }))}
            value={category}
            onChange={setCategory}
          />
        </Field>
        <Field label="Split" error={errors.split}>
          <Chips
            label="Split"
            options={[
              { id: 'even', label: `Evenly, ${memberIds.length} ways` },
              { id: 'custom', label: 'Custom amounts' },
            ]}
            value={splitMode}
            onChange={(mode) => {
              setSplitMode(mode);
              if (mode === 'custom' && Object.keys(customAmounts).length === 0) {
                setCustomAmounts(evenAmounts(memberIds, total));
              }
            }}
          />
          {splitMode === 'custom' && (
            <View style={styles.customSplit}>
              {memberIds.map((id) => (
                <View style={styles.customSplitRow} key={id}>
                  <Text style={styles.customSplitLabel}>{memberNames[id] ?? 'Former member'}</Text>
                  <TextInput
                    style={styles.customSplitInput}
                    keyboardType="decimal-pad"
                    value={customAmounts[id] ?? ''}
                    onChangeText={(v) => setCustomAmounts({ ...customAmounts, [id]: v })}
                    accessibilityLabel={`${memberNames[id] ?? 'Member'}'s share`}
                  />
                </View>
              ))}
              <Text style={[styles.splitRemaining, { color: balanced ? colors.route : colors.owe }]}>
                {balanced
                  ? 'Adds up to the total.'
                  : diff > 0
                    ? `${formatMoney(diff, currency)} left to assign`
                    : `${formatMoney(-diff, currency)} over the total`}
              </Text>
            </View>
          )}
        </Field>
        {errors.form && <Text style={styles.error}>{errors.form}</Text>}
      </ScrollView>
    </View>
  );
}

const CATEGORY_ICONS: Record<string, typeof Receipt> = {
  Food: ForkKnife,
  Transport: Train,
  Accommodation: Bed,
  Activities: Compass,
  Shopping: ShoppingBag,
  Tickets: Ticket,
};

/** Matches EXPENSE_CATEGORIES' order 1:1, same as web, so a category keeps its color. */
const categoryColor = (category: string) => {
  const i = (EXPENSE_CATEGORIES as readonly string[]).indexOf(category);
  return i >= 0 ? (CATEGORICAL_HUES[i] ?? NEUTRAL_HUE) : NEUTRAL_HUE;
};

/** How long "Undo" stays offered before a deletion is sent to the server. */
const UNDO_MS = 5000;

/** Splits someone other than the payer still owes. */
const openSplits = (e: Expense) => e.splits.filter((s) => s.userId !== e.paidById && !s.settled);

/** Headline numbers for the whole trip, plus where the money went by category. */
function Summary({
  expenses,
  currency,
  budget,
  currentUserId,
}: {
  expenses: Expense[];
  currency: string;
  budget?: string | null;
  currentUserId?: string;
}) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const money = (n: number) => formatMoney(n, currency);
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const myShare = expenses.reduce(
    (sum, e) => sum + e.splits.filter((s) => s.userId === currentUserId).reduce((a, s) => a + Number(s.amountOwed), 0),
    0,
  );
  const unsettled = expenses.reduce((sum, e) => sum + openSplits(e).reduce((a, s) => a + Number(s.amountOwed), 0), 0);
  const budgetNum = budget != null ? Number(budget) : null;
  const budgetPct = budgetNum ? (total / budgetNum) * 100 : null;
  const byCategory = [...new Set<string>([...EXPENSE_CATEGORIES, ...expenses.map((e) => e.category)])]
    .map((cat) => ({ cat, amount: expenses.filter((e) => e.category === cat).reduce((s, e) => s + Number(e.amount), 0) }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return (
    <View style={styles.summary}>
      <Text style={styles.statLabel}>Trip total</Text>
      <Text style={styles.statLead}>{money(total)}</Text>
      <View style={styles.statRow}>
        {currentUserId && (
          <View style={{ flex: 1 }}>
            <Text style={styles.statLabel}>Your share</Text>
            <Text style={styles.statValue}>{money(myShare)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.statLabel}>Still to settle</Text>
          <Text style={[styles.statValue, unsettled > 0.005 && { color: colors.ledger }]}>
            {unsettled > 0.005 ? money(unsettled) : 'All settled'}
          </Text>
        </View>
      </View>

      {budgetPct != null && budgetNum != null && (
        <View style={styles.budget}>
          <View style={styles.budgetLabels}>
            <Text style={styles.statLabel}>
              {Math.round(budgetPct)}% of {money(budgetNum)} budget
            </Text>
            <Text style={[styles.statLabel, budgetPct > 100 && { color: colors.owe, fontWeight: '600' }]}>
              {budgetPct > 100 ? `${money(total - budgetNum)} over` : `${money(budgetNum - total)} left`}
            </Text>
          </View>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityLabel="Budget used"
            accessibilityValue={{ min: 0, max: 100, now: Math.min(Math.round(budgetPct), 100) }}
          >
            <View
              style={[
                styles.trackFill,
                { width: `${Math.min(budgetPct, 100)}%`, backgroundColor: budgetPct > 100 ? colors.owe : colors.route },
              ]}
            />
          </View>
        </View>
      )}

      <View style={styles.mixBar} importantForAccessibility="no-hide-descendants">
        {byCategory.map((c) => (
          <View key={c.cat} style={{ flexGrow: c.amount, minWidth: 4, backgroundColor: categoryColor(c.cat) }} />
        ))}
      </View>
      <View style={styles.mixLegend}>
        {byCategory.map((c) => (
          <View key={c.cat} style={styles.mixItem}>
            <View style={[styles.mixDot, { backgroundColor: categoryColor(c.cat) }]} />
            <Text style={styles.mixText}>
              {c.cat} <Text style={styles.mixAmount}>{money(c.amount)}</Text> {Math.round((c.amount / total) * 100)}%
            </Text>
          </View>
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
  budget,
  currentUserId,
  onChange,
}: {
  tripId: string;
  expenses: Expense[];
  memberNames: Record<string, string>;
  currency: string;
  budget?: string | null;
  currentUserId?: string;
  onChange: () => void;
}) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // null = closed, 'new' = adding, else the expense being edited.
  const [editing, setEditing] = useState<Expense | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [unsettledOnly, setUnsettledOnly] = useState(false);
  // A deletion waiting out its undo window; it's already hidden from the list.
  const [deleted, setDeleted] = useState<Expense | null>(null);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flushDelete = useRef<() => void>(() => {});
  const name = (id: string) => (id === currentUserId ? 'You' : (memberNames[id] ?? 'Former member'));

  // Leaving the tab mid-undo still deletes the expense.
  useEffect(() => () => flushDelete.current(), []);

  const handleDelete = (expense: Expense) => {
    flushDelete.current();
    setExpandedId(null);
    setDeleted(expense);
    const send = () => {
      clearTimeout(deleteTimer.current);
      flushDelete.current = () => {};
      api
        .deleteExpense(tripId, expense.id)
        .then(onChange)
        .catch((err) => setError(err instanceof Error ? err.message : 'Could not delete expense'))
        .finally(() => setDeleted((d) => (d?.id === expense.id ? null : d)));
    };
    flushDelete.current = send;
    deleteTimer.current = setTimeout(send, UNDO_MS);
  };

  const undoDelete = () => {
    clearTimeout(deleteTimer.current);
    flushDelete.current = () => {};
    setDeleted(null);
  };

  const handleToggleSettled = async (expense: Expense, splitUserId: string, settled: boolean) => {
    try {
      await api.setSplitSettled(tripId, expense.id, splitUserId, settled);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update settlement');
    }
  };

  const visible = expenses.filter((e) => e.id !== deleted?.id);
  const query = search.trim().toLowerCase();
  const filtered = visible.filter(
    (e) =>
      (!query || e.description.toLowerCase().includes(query)) &&
      (!filterCategory || e.category === filterCategory) &&
      (!unsettledOnly || openSplits(e).length > 0),
  );
  const filtersActive = query !== '' || filterCategory !== null || unsettledOnly;
  const usedCategories = EXPENSE_CATEGORIES.filter((c) => visible.some((e) => e.category === c));

  // Newest day first, like a statement.
  const byDay = new Map<string, Expense[]>();
  for (const e of [...filtered].sort((a, b) => b.expenseDate.localeCompare(a.expenseDate))) {
    const day = dayKey(e.expenseDate);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(e);
  }

  const renderExpense = (expense: Expense, last: boolean) => {
    const expanded = expandedId === expense.id;
    const others = expense.splits.filter((s) => s.userId !== expense.paidById);
    const owing = openSplits(expense).length;
    const CategoryIcon = CATEGORY_ICONS[expense.category] ?? Receipt;
    const time = new Date(expense.expenseDate).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return (
      <View key={expense.id} style={[styles.rowWrap, !last && styles.rowDivider]}>
        <Tappable
          style={styles.row}
          onPress={() => setExpandedId(expanded ? null : expense.id)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
        >
          <View style={styles.catIcon}>
            <CategoryIcon size={18} weight="duotone" color={categoryColor(expense.category)} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle} numberOfLines={2}>
              {expense.description}
            </Text>
            <View style={styles.rowSubLine}>
              <Text style={styles.rowSub}>
                {time} · {name(expense.paidById)} paid
              </Text>
              {expense.receiptPhoto && <Receipt size={13} color={colors.inkSoft} />}
            </View>
          </View>
          <View style={styles.rowEnd}>
            <Text style={styles.amount}>{formatMoney(Number(expense.amount), expense.currency)}</Text>
            {others.length > 0 && (
              <Text style={[styles.status, owing ? styles.statusOpen : styles.statusSettled]}>
                {owing ? `${owing} ${owing === 1 ? 'owes' : 'owe'}` : 'Settled'}
              </Text>
            )}
          </View>
        </Tappable>

        {expanded && (
          <View style={styles.breakdown}>
            {expense.receiptPhoto && (
              <Image
                source={{ uri: expense.receiptPhoto }}
                style={styles.receipt}
                resizeMode="contain"
                accessibilityLabel={`Receipt for ${expense.description}`}
              />
            )}
            {others.length === 0 ? (
              <Text style={styles.splitLabel}>Nobody else owes anything on this one.</Text>
            ) : (
              others.map((s) => (
                <View style={styles.splitItem} key={s.userId}>
                  <Text style={styles.splitLabel}>
                    {name(s.userId)} {s.userId === currentUserId ? 'owe' : 'owes'}{' '}
                    <Text style={styles.splitAmount}>{formatMoney(Number(s.amountOwed), expense.currency)}</Text>
                  </Text>
                  <Text style={[styles.splitState, s.settled && { color: colors.route }]}>
                    {s.settled ? 'Paid back' : 'Owed'}
                  </Text>
                  <Switch
                    value={s.settled}
                    onValueChange={(v) => handleToggleSettled(expense, s.userId, v)}
                    trackColor={{ true: colors.route, false: colors.rule }}
                    accessibilityLabel={`${name(s.userId)} paid back`}
                  />
                </View>
              ))
            )}
            <View style={styles.rowActions}>
              <Button label="Edit" variant="secondary" size="sm" onPress={() => setEditing(expense)} />
              <Button label="Delete" variant="text" tone="danger" onPress={() => handleDelete(expense)} />
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View>
      {visible.length > 0 && (
        <Summary expenses={visible} currency={currency} budget={budget} currentUserId={currentUserId} />
      )}

      <Button label="Log an expense" onPress={() => setEditing('new')} style={{ marginBottom: 16 }} />
      {error && <Text style={styles.error}>{error}</Text>}

      {deleted && (
        <View style={styles.toast} accessibilityLiveRegion="polite">
          <Text style={styles.toastText} numberOfLines={1}>
            Deleted “{deleted.description}”
          </Text>
          <Tappable onPress={undoDelete} hitSlop={8} accessibilityRole="button">
            <Text style={styles.toastUndo}>Undo</Text>
          </Tappable>
        </View>
      )}

      {visible.length > 0 && (
        <View style={styles.filters}>
          <View style={styles.search}>
            <MagnifyingGlass size={16} color={colors.inkSoft} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search expenses"
              placeholderTextColor={colors.inkSoft}
              value={search}
              onChangeText={setSearch}
              accessibilityLabel="Search expenses"
              returnKeyType="search"
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
            <Tappable
              style={[styles.chip, unsettledOnly && styles.chipSelected]}
              onPress={() => setUnsettledOnly((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ selected: unsettledOnly }}
            >
              <Text style={[styles.chipText, unsettledOnly && styles.chipTextSelected]}>Unsettled</Text>
            </Tappable>
            <View style={styles.chipDivider} />
            {[null, ...usedCategories].map((c) => {
              const selected = filterCategory === c;
              return (
                <Tappable
                  key={c ?? 'all'}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setFilterCategory(c)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{c ?? 'All'}</Text>
                </Tappable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {visible.length === 0 ? (
        <View style={styles.emptyState}>
          <Receipt size={36} weight="duotone" color={colors.route} />
          <Text style={styles.emptyTitle}>No expenses yet</Text>
          <Text style={styles.emptyText}>
            Log what you spend as you go. Each expense is split between the group, and Balances works out who owes whom.
          </Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No expenses match these filters.</Text>
          {filtersActive && (
            <Button
              label="Clear filters"
              variant="text"
              onPress={() => {
                setSearch('');
                setFilterCategory(null);
                setUnsettledOnly(false);
              }}
            />
          )}
        </View>
      ) : (
        [...byDay.entries()].map(([day, list]) => {
          const dayTotal = list.reduce((sum, e) => sum + Number(e.amount), 0);
          return (
            <View key={day} style={styles.day}>
              <View style={styles.dayHead}>
                <Text style={styles.dayTitle}>{dayHeading(day)}</Text>
                <Text style={styles.dayTotal}>{formatMoney(dayTotal, currency)}</Text>
              </View>
              <View style={styles.card}>{list.map((e, i) => renderExpense(e, i === list.length - 1))}</View>
            </View>
          );
        })
      )}

      <Modal
        visible={editing !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditing(null)}
      >
        {editing !== null && (
          <ExpenseForm
            key={editing === 'new' ? 'new' : editing.id}
            tripId={tripId}
            initial={editing === 'new' ? undefined : editing}
            memberNames={memberNames}
            currency={currency}
            currentUserId={currentUserId}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              onChange();
            }}
          />
        )}
      </Modal>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    error: { fontSize: typeScale.footnote, color: colors.owe, marginBottom: 12 },
    emptyState: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 12, gap: 4 },
    emptyTitle: { fontSize: typeScale.body, fontWeight: '600', color: colors.ink, marginTop: 8 },
    emptyText: { fontSize: typeScale.subhead, lineHeight: 21, color: colors.inkSoft, textAlign: 'center' },

    summary: { borderRadius: radius.md, backgroundColor: colors.surface, padding: 16, marginBottom: 16 },
    statLabel: { fontSize: typeScale.footnote, color: colors.inkSoft },
    statLead: {
      fontSize: typeScale.title1,
      fontWeight: '700',
      letterSpacing: -0.5,
      color: colors.ink,
      fontVariant: ['tabular-nums'],
      marginBottom: 12,
    },
    statRow: { flexDirection: 'row', gap: 16 },
    statValue: { fontSize: typeScale.body, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'], marginTop: 2 },
    budget: { marginTop: 16, gap: 6 },
    budgetLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    track: { height: 8, borderRadius: 4, backgroundColor: colors.routeSoft, overflow: 'hidden' },
    trackFill: { height: '100%', borderRadius: 4 },
    mixBar: { flexDirection: 'row', gap: 2, height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 16 },
    mixLegend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6, marginTop: 10 },
    mixItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    mixDot: { width: 8, height: 8, borderRadius: 2 },
    mixText: { fontSize: typeScale.caption, color: colors.inkSoft, fontVariant: ['tabular-nums'] },
    mixAmount: { fontWeight: '600', color: colors.ink },

    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: radius.md,
      backgroundColor: colors.hero,
      marginBottom: 16,
    },
    toastText: { flex: 1, fontSize: typeScale.subhead, color: '#ffffff' },
    toastUndo: { fontSize: typeScale.subhead, fontWeight: '600', color: colors.highlight },

    filters: { marginBottom: 16, gap: 10 },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
    },
    searchInput: { flex: 1, minHeight: 42, fontSize: typeScale.subhead, color: colors.ink },
    filterChips: { gap: 8, alignItems: 'center' },
    chipDivider: { width: StyleSheet.hairlineWidth, height: 20, backgroundColor: colors.rule },

    day: { marginBottom: 20 },
    dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
    dayTitle: { fontSize: typeScale.footnote, fontWeight: '600', color: colors.inkSoft },
    dayTotal: { fontSize: typeScale.footnote, fontWeight: '600', color: colors.inkSoft, fontVariant: ['tabular-nums'] },
    card: { borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' },
    rowWrap: { paddingHorizontal: 14 },
    rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    catIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bg,
    },
    rowTitle: { fontSize: typeScale.subhead, fontWeight: '600', color: colors.ink },
    rowSubLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    rowSub: { fontSize: typeScale.footnote, color: colors.inkSoft },
    rowEnd: { alignItems: 'flex-end', gap: 3 },
    status: {
      fontSize: typeScale.caption,
      fontWeight: '500',
      paddingHorizontal: 8,
      paddingVertical: 1,
      borderRadius: 10,
      overflow: 'hidden',
    },
    statusOpen: { color: colors.ledger, backgroundColor: colors.ledgerSoft },
    statusSettled: { color: colors.route, backgroundColor: colors.routeSoft },
    receipt: { width: '100%', height: 180, borderRadius: radius.sm, backgroundColor: colors.bg },
    amount: { fontSize: typeScale.subhead, fontWeight: '600', fontVariant: ['tabular-nums'], color: colors.ink },
    breakdown: { paddingBottom: 12, gap: 10 },
    splitItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    splitLabel: { flex: 1, fontSize: typeScale.footnote, color: colors.inkSoft },
    splitAmount: { fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
    splitState: { fontSize: typeScale.caption, fontWeight: '600', color: colors.ledger },
    rowActions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 2 },

    sheet: { flex: 1, backgroundColor: colors.bg },
    sheetHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.rule,
    },
    sheetTitle: { fontSize: typeScale.body, fontWeight: '600', color: colors.ink },
    sheetBody: { padding: 20 },
    bigAmount: {
      fontSize: typeScale.largeTitle,
      fontWeight: '700',
      letterSpacing: -0.5,
      fontVariant: ['tabular-nums'],
      color: colors.ink,
      paddingVertical: 6,
      borderBottomWidth: 2,
      borderBottomColor: colors.rule,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.rule,
      backgroundColor: colors.surface,
    },
    chipSelected: { backgroundColor: colors.route, borderColor: colors.route },
    chipText: { fontSize: typeScale.footnote, fontWeight: '500', color: colors.ink },
    chipTextSelected: { color: colors.onRoute, fontWeight: '600' },
    customSplit: { marginTop: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.surface, gap: 8 },
    customSplitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    customSplitLabel: { fontSize: typeScale.subhead, color: colors.ink },
    customSplitInput: {
      width: 110,
      minHeight: 40,
      paddingHorizontal: 10,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.rule,
      backgroundColor: colors.bg,
      color: colors.ink,
      fontSize: typeScale.subhead,
      textAlign: 'right',
      fontVariant: ['tabular-nums'],
    },
    splitRemaining: { fontSize: typeScale.footnote, fontWeight: '500', marginTop: 2 },
  });
}
