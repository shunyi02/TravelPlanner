import { useState } from 'react';
import { EXPENSE_CATEGORIES, DEFAULT_EXPENSE_CATEGORY } from '@travel-planner/shared';
import { api } from '../api';
import { fromDatetimeLocalValue } from '../format';
import {
  clampToRange,
  computeTotal,
  nowForInput,
  sumAmounts,
  toShares,
  SplitEditor,
  type AmountMode,
  type SplitMode,
} from './expenseShared';

export function AddExpenseModal({
  tripId,
  memberIds,
  memberNames,
  currency,
  currentUserId,
  minExpenseDate,
  maxExpenseDate,
  onClose,
  onSaved,
}: {
  tripId: string;
  memberIds: string[];
  memberNames: Record<string, string>;
  currency: string;
  currentUserId?: string;
  minExpenseDate?: string;
  maxExpenseDate?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidById, setPaidById] = useState(currentUserId ?? memberIds[0] ?? '');
  const [category, setCategory] = useState<string>(DEFAULT_EXPENSE_CATEGORY);
  const [expenseDate, setExpenseDate] = useState(() => clampToRange(nowForInput(), minExpenseDate, maxExpenseDate));
  const [amountMode, setAmountMode] = useState<AmountMode>('base');
  const [servicePct, setServicePct] = useState('');
  const [taxPct, setTaxPct] = useState('');
  const [splitMode, setSplitMode] = useState<SplitMode>('even');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [showSplitEditor, setShowSplitEditor] = useState(false);
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(null);
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
  /** The actual total to charge: base amount times multiplier in 'base' mode,
   *  or just the amount as-is in 'total' mode (it already includes tax). */
  const total = amountMode === 'base' ? computeTotal(Number(amount) || 0, svcNum, taxNum) : Number(amount) || 0;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = Number(amount);
    if (!description.trim() || !parsed || parsed <= 0) return;
    if ((minExpenseDate && expenseDate < minExpenseDate) || (maxExpenseDate && expenseDate > maxExpenseDate)) {
      setError('Expense date must fall within the trip dates.');
      return;
    }

    const hasTax = amountMode === 'base' && (svcNum > 0 || taxNum > 0);
    const finalTotal = Number(total.toFixed(2));
    // Custom amounts are base-fare shares when tax applies (so members enter
    // what they ordered, not a pre-computed taxed amount) — otherwise they're
    // just the plain total, same as before tax support existed.
    const baseForSplit = amountMode === 'base' ? parsed : finalTotal;

    let splits: Array<{ userId: string; share: number }> | undefined;
    if (showSplitEditor && splitMode === 'custom') {
      if (Math.abs(baseForSplit - sumAmounts(customAmounts)) > 0.01) {
        setError(hasTax ? 'Custom amounts must add up to the base fare.' : 'Custom amounts must add up to the total.');
        return;
      }
      splits = toShares(customAmounts);
    }

    setSaving(true);
    try {
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
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log expense');
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Log expense</h2>
        <form onSubmit={handleAdd} className="expense-form">
          <input placeholder="Name" value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />

          <div className="receipt-photo-row">
            {receiptPhoto && <img className="receipt-photo-thumb" src={receiptPhoto} alt="" />}
            <label className="btn btn-outline">
              {receiptPhoto ? 'Change receipt photo' : 'Add receipt photo'}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleReceiptFile(e.target.files?.[0] ?? null)}
                hidden
              />
            </label>
            {receiptPhoto && (
              <button type="button" className="text-btn text-btn-danger" onClick={() => setReceiptPhoto(null)}>
                Remove
              </button>
            )}
          </div>

          <div className="expense-form-row">
            <input
              placeholder={amountMode === 'base' ? `Base fare (${currency})` : `Total (${currency})`}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="expense-amount-input"
            />
            <div className="segmented-control">
              <button type="button" className={amountMode === 'base' ? 'active' : ''} onClick={() => setAmountMode('base')}>
                Base fare
              </button>
              <button type="button" className={amountMode === 'total' ? 'active' : ''} onClick={() => setAmountMode('total')}>
                Total (tax incl.)
              </button>
            </div>
          </div>

          {amountMode === 'base' && (
            <div className="expense-form-row">
              <label className="field-label">
                Service %
                <input inputMode="decimal" value={servicePct} onChange={(e) => setServicePct(e.target.value)} />
              </label>
              <label className="field-label">
                Tax %
                <input inputMode="decimal" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} />
              </label>
            </div>
          )}

          {amountMode === 'base' && Number(amount) > 0 && (
            <p className="expense-total-preview">Total (incl. tax): {currency} {total.toFixed(2)}</p>
          )}

          <div className="expense-form-row">
            <label className="field-label">
              Paid by
              <select value={paidById} onChange={(e) => setPaidById(e.target.value)}>
                {memberIds.map((id) => (
                  <option key={id} value={id}>{memberNames[id] ?? id}</option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Category
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
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

          <button
            type="button"
            className="text-btn align-start"
            onClick={() => setShowSplitEditor((v) => !v)}
          >
            {showSplitEditor ? 'Hide split options' : 'Split options (defaults to evenly)'}
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
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Confirm'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
