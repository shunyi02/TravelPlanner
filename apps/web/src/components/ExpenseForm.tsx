import { useState, type FormEvent } from 'react';
import { EXPENSE_CATEGORIES, DEFAULT_EXPENSE_CATEGORY } from '@travel-planner/shared';
import { api, type Expense } from '../api';
import { formatMoney, fromDatetimeLocalValue, toDatetimeLocalValue } from '../format';
import {
  clampToRange,
  computeTotal,
  looksEven,
  nowForInput,
  sumAmounts,
  toShares,
  SplitEditor,
  type AmountMode,
  type SplitMode,
} from './expenseShared';

type ExpenseUpdate = Parameters<typeof api.updateExpense>[2];

/**
 * Logs a new expense, or edits `expense` when given. Edits send only the
 * fields that changed.
 */
export function ExpenseForm({
  tripId,
  expense,
  memberIds,
  memberNames,
  currency,
  currentUserId,
  minExpenseDate,
  maxExpenseDate,
  onCancel,
  onSaved,
}: {
  tripId: string;
  expense?: Expense;
  memberIds: string[];
  memberNames: Record<string, string>;
  currency: string;
  currentUserId?: string;
  minExpenseDate?: string;
  maxExpenseDate?: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const initialSplitMode: SplitMode = expense && !looksEven(expense, memberIds) ? 'custom' : 'even';

  const [description, setDescription] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(expense ? (expense.subtotal ?? expense.amount) : '');
  const [amountMode, setAmountMode] = useState<AmountMode>(expense && expense.subtotal == null ? 'total' : 'base');
  const [servicePct, setServicePct] = useState(expense?.servicePct ?? '');
  const [taxPct, setTaxPct] = useState(expense?.taxPct ?? '');
  const [paidById, setPaidById] = useState(expense?.paidById ?? currentUserId ?? memberIds[0] ?? '');
  const [category, setCategory] = useState<string>(expense?.category ?? DEFAULT_EXPENSE_CATEGORY);
  const [expenseDate, setExpenseDate] = useState(() =>
    expense ? toDatetimeLocalValue(expense.expenseDate) : clampToRange(nowForInput(), minExpenseDate, maxExpenseDate),
  );
  const [splitMode, setSplitMode] = useState<SplitMode>(initialSplitMode);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(() =>
    expense ? Object.fromEntries(expense.splits.map((s) => [s.userId, s.amountOwed])) : {},
  );
  const [showSplitEditor, setShowSplitEditor] = useState(initialSplitMode === 'custom');
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(expense?.receiptPhoto ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReceiptFile = (file: File | null) => {
    if (!file) {
      setReceiptPhoto(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setReceiptPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const svcNum = Number(servicePct) || 0;
  const taxNum = Number(taxPct) || 0;
  /** (1 + service%)(1 + tax%), or 1 in 'total' mode where there's nothing to add. */
  const multiplier = amountMode === 'base' ? (1 + svcNum / 100) * (1 + taxNum / 100) : 1;
  /** The actual total: base times multiplier in 'base' mode, or the amount as-is in 'total' mode. */
  const total = amountMode === 'base' ? computeTotal(Number(amount) || 0, svcNum, taxNum) : Number(amount) || 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = Number(amount);
    if (!description.trim()) return setError('Give the expense a name.');
    if (!parsed || parsed <= 0) return setError('Enter an amount above zero.');
    // When editing, only enforce trip-date bounds if the date actually changed: an
    // expense logged before the trip dates were set or narrowed shouldn't block other edits.
    const dateChanged = !expense || expenseDate !== toDatetimeLocalValue(expense.expenseDate);
    if (
      dateChanged &&
      ((minExpenseDate && expenseDate < minExpenseDate) || (maxExpenseDate && expenseDate > maxExpenseDate))
    ) {
      return setError('Expense date must fall within the trip dates.');
    }

    const hasTax = amountMode === 'base' && (svcNum > 0 || taxNum > 0);
    const finalTotal = Number(total.toFixed(2));
    // Custom amounts are base-fare shares when tax applies (so members enter
    // what they ordered, not a pre-computed taxed amount), else the plain total.
    const baseForSplit = amountMode === 'base' ? parsed : finalTotal;

    let splits: Array<{ userId: string; share: number }> | undefined;
    if (showSplitEditor && splitMode === 'custom') {
      if (Math.abs(baseForSplit - sumAmounts(customAmounts)) > 0.01) {
        return setError(hasTax ? 'Custom amounts must add up to the base fare.' : 'Custom amounts must add up to the total.');
      }
      splits = toShares(customAmounts);
    } else if (initialSplitMode === 'custom') {
      // Explicitly switched an existing expense back to an even split.
      splits = memberIds.map((id) => ({ userId: id, share: 1 / memberIds.length }));
    }

    setSaving(true);
    try {
      if (expense) {
        await api.updateExpense(tripId, expense.id, changedFields(expense, {
          description: description.trim(),
          amount: finalTotal,
          subtotal: hasTax ? parsed : null,
          servicePct: hasTax && svcNum > 0 ? svcNum : null,
          taxPct: hasTax && taxNum > 0 ? taxNum : null,
          paidById,
          category,
          expenseDate: fromDatetimeLocalValue(expenseDate),
          receiptPhoto,
          splits,
        }));
      } else {
        await api.createExpense(tripId, {
          description: description.trim(),
          amount: finalTotal,
          subtotal: hasTax ? parsed : undefined,
          servicePct: hasTax && svcNum > 0 ? svcNum : undefined,
          taxPct: hasTax && taxNum > 0 ? taxNum : undefined,
          paidById,
          category,
          expenseDate: fromDatetimeLocalValue(expenseDate),
          receiptPhoto: receiptPhoto ?? undefined,
          splits,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the expense');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="expense-form">
      <label className="field">
        What was it?
        <input
          placeholder="e.g. Dinner at Nishiki Market"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          autoFocus
        />
      </label>

      <div className="field">
        <span id="expense-amount-label">Amount ({currency})</span>
        <div className="expense-form-row">
          <input
            aria-labelledby="expense-amount-label"
            placeholder="0.00"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="expense-amount-input"
          />
          <div className="segmented-control" role="group" aria-label="Amount is">
            <button
              type="button"
              className={amountMode === 'base' ? 'active' : ''}
              aria-pressed={amountMode === 'base'}
              onClick={() => setAmountMode('base')}
            >
              Before tax
            </button>
            <button
              type="button"
              className={amountMode === 'total' ? 'active' : ''}
              aria-pressed={amountMode === 'total'}
              onClick={() => setAmountMode('total')}
            >
              Tax included
            </button>
          </div>
        </div>
      </div>

      {amountMode === 'base' && (
        <div className="expense-form-row">
          <label className="field-label">
            Service %
            <input inputMode="decimal" placeholder="0" value={servicePct} onChange={(e) => setServicePct(e.target.value)} />
          </label>
          <label className="field-label">
            Tax %
            <input inputMode="decimal" placeholder="0" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} />
          </label>
        </div>
      )}

      {amountMode === 'base' && Number(amount) > 0 && multiplier !== 1 && (
        <p className="expense-total-preview">
          Total with service and tax: <strong className="amount">{formatMoney(total, currency)}</strong>
        </p>
      )}

      <div className="expense-form-row">
        <label className="field-label">
          Paid by
          <select value={paidById} onChange={(e) => setPaidById(e.target.value)}>
            {memberIds.map((id) => (
              <option key={id} value={id}>
                {memberNames[id] ?? id}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field-label">
        When
        <input
          type="datetime-local"
          value={expenseDate}
          onChange={(e) => setExpenseDate(e.target.value)}
          min={minExpenseDate}
          max={maxExpenseDate}
        />
      </label>

      <div className="receipt-photo-row">
        {receiptPhoto && <img className="receipt-photo-thumb" src={receiptPhoto} alt="Receipt" />}
        <label className="btn btn-outline btn-sm">
          {receiptPhoto ? 'Change receipt' : 'Add receipt photo'}
          <input type="file" accept="image/*" onChange={(e) => handleReceiptFile(e.target.files?.[0] ?? null)} hidden />
        </label>
        {receiptPhoto && (
          <button type="button" className="text-btn text-btn-danger" onClick={() => setReceiptPhoto(null)}>
            Remove
          </button>
        )}
      </div>

      <button
        type="button"
        className="text-btn align-start"
        aria-expanded={showSplitEditor}
        onClick={() => setShowSplitEditor((v) => !v)}
      >
        {showSplitEditor ? 'Hide split options' : 'Split options (evenly by default)'}
      </button>
      {showSplitEditor && (
        <SplitEditor
          memberIds={memberIds}
          memberNames={memberNames}
          total={amountMode === 'base' ? Number(amount) || 0 : total}
          taxMultiplier={multiplier}
          currency={currency}
          mode={splitMode}
          onModeChange={setSplitMode}
          amounts={customAmounts}
          onAmountsChange={setCustomAmounts}
        />
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn" disabled={saving}>
          {saving ? 'Saving…' : expense ? 'Save' : 'Log expense'}
        </button>
      </div>
    </form>
  );
}

/** The subset of `next` that differs from `expense`, so an edit only touches what changed. */
function changedFields(
  expense: Expense,
  next: Required<Omit<ExpenseUpdate, 'splits'>> & Pick<ExpenseUpdate, 'splits'>,
): ExpenseUpdate {
  const num = (v: string | null) => (v != null ? Number(v) : null);
  const data: ExpenseUpdate = {};
  if (next.description !== expense.description) data.description = next.description;
  if (next.amount !== Number(expense.amount)) data.amount = next.amount;
  if (next.subtotal !== num(expense.subtotal)) data.subtotal = next.subtotal;
  if (next.servicePct !== num(expense.servicePct)) data.servicePct = next.servicePct;
  if (next.taxPct !== num(expense.taxPct)) data.taxPct = next.taxPct;
  if (next.paidById !== expense.paidById) data.paidById = next.paidById;
  if (next.category !== expense.category) data.category = next.category;
  if (next.expenseDate !== new Date(expense.expenseDate).toISOString()) data.expenseDate = next.expenseDate;
  if (next.receiptPhoto !== expense.receiptPhoto) data.receiptPhoto = next.receiptPhoto;
  if (next.splits) data.splits = next.splits;
  return data;
}
