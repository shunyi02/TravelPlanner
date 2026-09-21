import { useState } from 'react';
import { EXPENSE_CATEGORIES, DEFAULT_EXPENSE_CATEGORY } from '@travel-planner/shared';
import type { Expense } from '../api';
import { api } from '../api';
import { formatDateTime, fromDatetimeLocalValue, toDatetimeLocalValue } from '../format';
import { CategoryPieChart } from './CategoryPieChart';

const nowForInput = () => toDatetimeLocalValue(new Date().toISOString());

type SplitMode = 'even' | 'custom';

function evenAmounts(memberIds: string[], total: number): Record<string, string> {
  if (memberIds.length === 0) return {};
  const each = total / memberIds.length;
  return Object.fromEntries(memberIds.map((id) => [id, each ? each.toFixed(2) : '']));
}

/** Applies service charge then tax on top, both as percentages, compounding
 *  (tax is charged on the post-service-charge amount, matching how a
 *  restaurant bill actually adds them). Either can be 0. */
function computeTotal(base: number, servicePct: number, taxPct: number): number {
  return base * (1 + servicePct / 100) * (1 + taxPct / 100);
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

/** Splits are treated as "even" if every trip member owes an equal share. */
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
    <div>
      <div className="split-mode-row">
        <label>
          <input
            type="radio"
            checked={mode === 'even'}
            onChange={() => onModeChange('even')}
          />{' '}
          Split evenly
        </label>
        <label>
          <input
            type="radio"
            checked={mode === 'custom'}
            onChange={() => {
              onModeChange('custom');
              if (Object.keys(amounts).length === 0) onAmountsChange(evenAmounts(memberIds, total));
            }}
          />{' '}
          Custom amounts
        </label>
      </div>
      {mode === 'custom' && (
        <div className="custom-split-grid">
          {memberIds.map((id) => (
            <div className="custom-split-row" key={id}>
              <span>{memberNames[id] ?? id}</span>
              <input
                inputMode="decimal"
                value={amounts[id] ?? ''}
                onChange={(e) => onAmountsChange({ ...amounts, [id]: e.target.value })}
              />
            </div>
          ))}
          <p className={`split-remaining ${balanced ? 'balanced' : 'unbalanced'}`}>
            {balanced ? 'Splits add up.' : diff > 0 ? `${diff.toFixed(2)} left to assign` : `${Math.abs(diff).toFixed(2)} over`}
          </p>
        </div>
      )}
    </div>
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
  const [category, setCategory] = useState<string>(DEFAULT_EXPENSE_CATEGORY);
  const [expenseDate, setExpenseDate] = useState(nowForInput());
  const [servicePct, setServicePct] = useState('');
  const [taxPct, setTaxPct] = useState('');
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
  const [editExpenseDate, setEditExpenseDate] = useState(nowForInput());
  const [editServicePct, setEditServicePct] = useState('');
  const [editTaxPct, setEditTaxPct] = useState('');
  const [editSplitMode, setEditSplitMode] = useState<SplitMode>('even');
  const [initialEditSplitMode, setInitialEditSplitMode] = useState<SplitMode>('even');
  const [editCustomAmounts, setEditCustomAmounts] = useState<Record<string, string>>({});
  const [showEditSplitEditor, setShowEditSplitEditor] = useState(false);

  /** The actual total to charge/split: base amount plus service charge and
   *  tax, when those options are in use (otherwise just the base amount). */
  const total = computeTotal(Number(amount) || 0, Number(servicePct) || 0, Number(taxPct) || 0);
  const editTotal = computeTotal(Number(editAmount) || 0, Number(editServicePct) || 0, Number(editTaxPct) || 0);

  const resetAddForm = () => {
    setDescription('');
    setAmount('');
    setServicePct('');
    setTaxPct('');
    setPaidById(currentUserId ?? memberIds[0] ?? '');
    setCategory(DEFAULT_EXPENSE_CATEGORY);
    setExpenseDate(nowForInput());
    setSplitMode('even');
    setCustomAmounts({});
    setShowSplitEditor(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = Number(amount);
    if (!description.trim() || !parsed || parsed <= 0) return;

    const svc = Number(servicePct) || 0;
    const tax = Number(taxPct) || 0;
    const hasTax = svc > 0 || tax > 0;
    const finalTotal = Number(computeTotal(parsed, svc, tax).toFixed(2));

    let splits: Array<{ userId: string; share: number }> | undefined;
    if (showSplitEditor && splitMode === 'custom') {
      if (Math.abs(finalTotal - sumAmounts(customAmounts)) > 0.01) {
        setError('Custom amounts must add up to the total.');
        return;
      }
      splits = toShares(customAmounts);
    }

    try {
      await api.createExpense(tripId, {
        description: description.trim(),
        amount: finalTotal,
        subtotal: hasTax ? parsed : undefined,
        servicePct: hasTax && svc > 0 ? svc : undefined,
        taxPct: hasTax && tax > 0 ? tax : undefined,
        paidById,
        category,
        expenseDate: fromDatetimeLocalValue(expenseDate),
        splits,
      });
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
    setEditAmount(expense.subtotal ?? expense.amount);
    setEditServicePct(expense.servicePct ?? '');
    setEditTaxPct(expense.taxPct ?? '');
    setEditPaidById(expense.paidById);
    setEditCategory(expense.category);
    setEditExpenseDate(toDatetimeLocalValue(expense.expenseDate));
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

    const svc = Number(editServicePct) || 0;
    const tax = Number(editTaxPct) || 0;
    const hasTax = svc > 0 || tax > 0;
    const newTotal = Number(computeTotal(parsedAmount, svc, tax).toFixed(2));
    const newSubtotal = hasTax ? parsedAmount : null;
    const newServicePct = hasTax && svc > 0 ? svc : null;
    const newTaxPct = hasTax && tax > 0 ? tax : null;

    const data: {
      description?: string;
      amount?: number;
      paidById?: string;
      category?: string;
      expenseDate?: string;
      subtotal?: number | null;
      servicePct?: number | null;
      taxPct?: number | null;
      splits?: Array<{ userId: string; share: number }>;
    } = {};
    if (editDescription.trim() !== expense.description) data.description = editDescription.trim();
    if (newTotal !== Number(expense.amount)) data.amount = newTotal;
    if (newSubtotal !== (expense.subtotal != null ? Number(expense.subtotal) : null)) data.subtotal = newSubtotal;
    if (newServicePct !== (expense.servicePct != null ? Number(expense.servicePct) : null)) data.servicePct = newServicePct;
    if (newTaxPct !== (expense.taxPct != null ? Number(expense.taxPct) : null)) data.taxPct = newTaxPct;
    if (editPaidById !== expense.paidById) data.paidById = editPaidById;
    if (editCategory !== expense.category) data.category = editCategory;
    const editExpenseDateIso = fromDatetimeLocalValue(editExpenseDate);
    if (editExpenseDateIso !== new Date(expense.expenseDate).toISOString()) data.expenseDate = editExpenseDateIso;

    if (showEditSplitEditor && editSplitMode === 'custom') {
      if (Math.abs(newTotal - sumAmounts(editCustomAmounts)) > 0.01) {
        setError('Custom amounts must add up to the total.');
        return;
      }
      data.splits = toShares(editCustomAmounts);
    } else if (initialEditSplitMode === 'custom') {
      // User explicitly switched this expense back to an even split.
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

  const handleDelete = async (expense: Expense) => {
    if (!confirm(`Delete "${expense.description}"? This can't be undone.`)) return;
    try {
      await api.deleteExpense(tripId, expense.id);
      if (expandedId === expense.id) setExpandedId(null);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete expense');
    }
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
    <div>
      {expenses.length === 0 ? (
        <p className="empty-state">No expenses logged yet.</p>
      ) : (
        <div>
          {expenses.map((expense) => (
            <div key={expense.id}>
              <div className="ledger-row" style={{ cursor: 'pointer' }} onClick={() => toggleExpand(expense.id)}>
                <div className="row-main">
                  <span className="row-title">{expense.description}</span>
                  <span className="row-sub">
                    <span className="category-badge">{expense.category}</span>
                    {' · paid by '}{memberNames[expense.paidById] ?? 'someone'}
                    {' · '}{formatDateTime(expense.expenseDate)}
                    {expense.subtotal != null && (
                      <>
                        {' · '}{expense.currency} {expense.subtotal}
                        {expense.servicePct != null && ` +${expense.servicePct}% service`}
                        {expense.taxPct != null && ` +${expense.taxPct}% tax`}
                      </>
                    )}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="amount">
                    {expense.currency} {expense.amount}
                  </span>
                  <div className="ledger-row-actions">
                    <button
                      type="button"
                      className="text-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(expense);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-btn text-btn-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(expense);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              {expandedId === expense.id && editingId !== expense.id && (
                <div className="split-breakdown">
                  {expense.splits.filter((s) => s.userId !== expense.paidById).length === 0 ? (
                    <p className="split-item">Nobody else owes anything on this one.</p>
                  ) : (
                    expense.splits
                      .filter((s) => s.userId !== expense.paidById)
                      .map((s) => (
                        <label className="split-item" key={s.userId}>
                          <span>
                            {memberNames[s.userId] ?? s.userId} owes {expense.currency} {s.amountOwed}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {s.settled ? 'Settled' : 'Not settled'}
                            <input
                              type="checkbox"
                              checked={s.settled}
                              onChange={(e) => handleToggleSettled(expense, s.userId, e.target.checked)}
                            />
                          </span>
                        </label>
                      ))
                  )}
                </div>
              )}

              {editingId === expense.id && (
                <div className="split-breakdown">
                  <input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Name"
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <input
                      inputMode="decimal"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      placeholder={`Price (${currency})`}
                      style={{ maxWidth: 140 }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-soft)' }}>
                      Service %
                      <input
                        inputMode="decimal"
                        value={editServicePct}
                        onChange={(e) => setEditServicePct(e.target.value)}
                        style={{ maxWidth: 60 }}
                      />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-soft)' }}>
                      Tax %
                      <input
                        inputMode="decimal"
                        value={editTaxPct}
                        onChange={(e) => setEditTaxPct(e.target.value)}
                        style={{ maxWidth: 60 }}
                      />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-soft)' }}>
                      Paid by
                      <select value={editPaidById} onChange={(e) => setEditPaidById(e.target.value)}>
                        {memberIds.map((id) => (
                          <option key={id} value={id}>{memberNames[id] ?? id}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {Number(editAmount) > 0 && (
                    <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
                      Total (incl. tax): {currency} {editTotal.toFixed(2)}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-soft)' }}>
                      Category
                      <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                        {EXPENSE_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-soft)' }}>
                      When
                      <input
                        type="datetime-local"
                        value={editExpenseDate}
                        onChange={(e) => setEditExpenseDate(e.target.value)}
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => setShowEditSplitEditor((v) => !v)}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    {showEditSplitEditor ? 'Hide split options' : 'Split options'}
                  </button>
                  {showEditSplitEditor && (
                    <SplitEditor
                      memberIds={memberIds}
                      memberNames={memberNames}
                      total={editTotal}
                      mode={editSplitMode}
                      onModeChange={setEditSplitMode}
                      amounts={editCustomAmounts}
                      onAmountsChange={setEditCustomAmounts}
                    />
                  )}
                  <div className="row-actions">
                    <button type="button" className="btn" onClick={() => handleSaveEdit(expense)}>
                      Save
                    </button>
                    <button type="button" className="btn btn-outline" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} style={{ marginTop: 20 }}>
        <div className="form-inline" style={{ marginTop: 0 }}>
          <input
            placeholder="Name"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <input
            placeholder={`Price (${currency})`}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ maxWidth: 140 }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-soft)' }}>
            Service %
            <input
              inputMode="decimal"
              value={servicePct}
              onChange={(e) => setServicePct(e.target.value)}
              style={{ maxWidth: 60 }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-soft)' }}>
            Tax %
            <input
              inputMode="decimal"
              value={taxPct}
              onChange={(e) => setTaxPct(e.target.value)}
              style={{ maxWidth: 60 }}
            />
          </label>
          <button className="btn" type="submit">
            Log expense
          </button>
        </div>
        {Number(amount) > 0 && (
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '8px 0 0' }}>
            Total (incl. tax): {currency} {total.toFixed(2)}
          </p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-soft)' }}>
            Paid by
            <select value={paidById} onChange={(e) => setPaidById(e.target.value)}>
              {memberIds.map((id) => (
                <option key={id} value={id}>{memberNames[id] ?? id}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-soft)' }}>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-soft)' }}>
            When
            <input type="datetime-local" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
          </label>
        </div>
        <button
          type="button"
          className="text-btn"
          onClick={() => setShowSplitEditor((v) => !v)}
          style={{ display: 'block', marginTop: 8 }}
        >
          {showSplitEditor ? 'Hide split options' : 'Split options (defaults to evenly)'}
        </button>
        {showSplitEditor && (
          <SplitEditor
            memberIds={memberIds}
            memberNames={memberNames}
            total={total}
            mode={splitMode}
            onModeChange={setSplitMode}
            amounts={customAmounts}
            onAmountsChange={setCustomAmounts}
          />
        )}
        {error && <p style={{ color: 'var(--owe)' }}>{error}</p>}
      </form>

      <CategoryPieChart expenses={expenses} currency={currency} />
    </div>
  );
}
