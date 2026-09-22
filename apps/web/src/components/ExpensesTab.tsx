import { useState } from 'react';
import { EXPENSE_CATEGORIES, DEFAULT_EXPENSE_CATEGORY } from '@travel-planner/shared';
import type { Expense } from '../api';
import { api } from '../api';
import { dateKey, formatDateTime, formatDayHeading, fromDatetimeLocalValue, toDatetimeLocalValue } from '../format';
import { CategoryPieChart } from './CategoryPieChart';
import { AddExpenseModal } from './AddExpenseModal';
import {
  computeTotal,
  expenseDateBounds,
  looksEven,
  nowForInput,
  sumAmounts,
  toShares,
  SplitEditor,
  type AmountMode,
  type SplitMode,
} from './expenseShared';

/** Groups expenses by calendar day (in the viewer's local time), preserving
 *  first-seen order, each with its day heading and spending total. */
function groupByDay(
  expenses: Expense[],
): Array<{ key: string; heading: string; items: Expense[]; total: number }> {
  const groups: Array<{ key: string; heading: string; items: Expense[]; total: number }> = [];
  for (const expense of expenses) {
    const key = dateKey(expense.expenseDate);
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, heading: formatDayHeading(expense.expenseDate), items: [], total: 0 };
      groups.push(group);
    }
    group.items.push(expense);
    group.total += Number(expense.amount);
  }
  return groups;
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Downloads the given expenses as a CSV: one row per expense, one column
 *  listing who owes what and whether it's settled. */
function exportExpensesCsv(expenses: Expense[], memberNames: Record<string, string>) {
  const header = ['Date', 'Description', 'Category', 'Paid by', 'Amount', 'Currency', 'Splits'];
  const rows = expenses.map((e) => {
    const splits = e.splits
      .filter((s) => s.userId !== e.paidById)
      .map((s) => `${memberNames[s.userId] ?? s.userId}: ${s.amountOwed} (${s.settled ? 'settled' : 'unsettled'})`)
      .join('; ');
    return [
      new Date(e.expenseDate).toISOString().slice(0, 10),
      e.description,
      e.category,
      memberNames[e.paidById] ?? e.paidById,
      e.amount,
      e.currency,
      splits,
    ];
  });
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ExpensesTab({
  tripId,
  expenses,
  memberNames,
  currency,
  currentUserId,
  tripStartDate,
  tripEndDate,
  onChange,
}: {
  tripId: string;
  expenses: Expense[];
  memberNames: Record<string, string>;
  currency: string;
  currentUserId?: string;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
  onChange: () => void;
}) {
  const memberIds = Object.keys(memberNames);
  // Bounds for the expense date pickers, so logged expenses stay within the trip's travel dates.
  const { min: minExpenseDate, max: maxExpenseDate } = expenseDateBounds(tripStartDate, tripEndDate);

  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPaidBy, setFilterPaidBy] = useState('all');
  const [unsettledOnly, setUnsettledOnly] = useState(false);

  const filteredExpenses = expenses.filter((e) => {
    if (filterCategory !== 'all' && e.category !== filterCategory) return false;
    if (filterPaidBy !== 'all' && e.paidById !== filterPaidBy) return false;
    if (unsettledOnly && !e.splits.some((s) => s.userId !== e.paidById && !s.settled)) return false;
    return true;
  });
  const filtersActive = filterCategory !== 'all' || filterPaidBy !== 'all' || unsettledOnly;
  const dayGroups = groupByDay(filteredExpenses);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editPaidById, setEditPaidById] = useState('');
  const [editCategory, setEditCategory] = useState<string>(DEFAULT_EXPENSE_CATEGORY);
  const [editExpenseDate, setEditExpenseDate] = useState(nowForInput());
  const [editAmountMode, setEditAmountMode] = useState<AmountMode>('base');
  const [editServicePct, setEditServicePct] = useState('');
  const [editTaxPct, setEditTaxPct] = useState('');
  const [editSplitMode, setEditSplitMode] = useState<SplitMode>('even');
  const [initialEditSplitMode, setInitialEditSplitMode] = useState<SplitMode>('even');
  const [editCustomAmounts, setEditCustomAmounts] = useState<Record<string, string>>({});
  const [showEditSplitEditor, setShowEditSplitEditor] = useState(false);
  const [editReceiptPhoto, setEditReceiptPhoto] = useState<string | null>(null);

  const handleEditReceiptFile = (file: File | null) => {
    if (!file) {
      setEditReceiptPhoto(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setEditReceiptPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const editSvcNum = Number(editServicePct) || 0;
  const editTaxNum = Number(editTaxPct) || 0;
  const editMultiplier = editAmountMode === 'base' ? (1 + editSvcNum / 100) * (1 + editTaxNum / 100) : 1;
  const editTotal =
    editAmountMode === 'base' ? computeTotal(Number(editAmount) || 0, editSvcNum, editTaxNum) : Number(editAmount) || 0;

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
    setEditAmountMode(expense.subtotal != null ? 'base' : 'total');
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
    setEditReceiptPhoto(expense.receiptPhoto);
  };

  const handleSaveEdit = async (expense: Expense) => {
    setError(null);
    const parsedAmount = Number(editAmount);
    if (!editDescription.trim() || !parsedAmount || parsedAmount <= 0) return;
    // Only enforce trip-date bounds when the date was actually changed — an
    // expense logged before the trip dates were set/narrowed shouldn't block
    // unrelated edits.
    const dateChanged = editExpenseDate !== toDatetimeLocalValue(expense.expenseDate);
    if (
      dateChanged &&
      ((minExpenseDate && editExpenseDate < minExpenseDate) || (maxExpenseDate && editExpenseDate > maxExpenseDate))
    ) {
      setError('Expense date must fall within the trip dates.');
      return;
    }

    const hasTax = editAmountMode === 'base' && (editSvcNum > 0 || editTaxNum > 0);
    const newTotal = Number(editTotal.toFixed(2));
    const newSubtotal = hasTax ? parsedAmount : null;
    const newServicePct = hasTax && editSvcNum > 0 ? editSvcNum : null;
    const newTaxPct = hasTax && editTaxNum > 0 ? editTaxNum : null;
    const baseForSplit = editAmountMode === 'base' ? parsedAmount : newTotal;

    const data: {
      description?: string;
      amount?: number;
      paidById?: string;
      category?: string;
      expenseDate?: string;
      subtotal?: number | null;
      servicePct?: number | null;
      taxPct?: number | null;
      receiptPhoto?: string | null;
      splits?: Array<{ userId: string; share: number }>;
    } = {};
    if (editDescription.trim() !== expense.description) data.description = editDescription.trim();
    if (editReceiptPhoto !== expense.receiptPhoto) data.receiptPhoto = editReceiptPhoto;
    if (newTotal !== Number(expense.amount)) data.amount = newTotal;
    if (newSubtotal !== (expense.subtotal != null ? Number(expense.subtotal) : null)) data.subtotal = newSubtotal;
    if (newServicePct !== (expense.servicePct != null ? Number(expense.servicePct) : null)) data.servicePct = newServicePct;
    if (newTaxPct !== (expense.taxPct != null ? Number(expense.taxPct) : null)) data.taxPct = newTaxPct;
    if (editPaidById !== expense.paidById) data.paidById = editPaidById;
    if (editCategory !== expense.category) data.category = editCategory;
    const editExpenseDateIso = fromDatetimeLocalValue(editExpenseDate);
    if (editExpenseDateIso !== new Date(expense.expenseDate).toISOString()) data.expenseDate = editExpenseDateIso;

    if (showEditSplitEditor && editSplitMode === 'custom') {
      if (Math.abs(baseForSplit - sumAmounts(editCustomAmounts)) > 0.01) {
        setError(hasTax ? 'Custom amounts must add up to the base fare.' : 'Custom amounts must add up to the total.');
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
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setShowAddModal(true)}>
            + Add expense
          </button>
          {expenses.length > 0 && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => exportExpensesCsv(filteredExpenses, memberNames)}
            >
              Export CSV
            </button>
          )}
        </div>
        {expenses.length > 0 && (
          <div className="expense-filter-row">
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="all">All categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select value={filterPaidBy} onChange={(e) => setFilterPaidBy(e.target.value)}>
              <option value="all">Paid by anyone</option>
              {memberIds.map((id) => (
                <option key={id} value={id}>Paid by {memberNames[id] ?? id}</option>
              ))}
            </select>
            <label className="expense-filter-checkbox">
              <input type="checkbox" checked={unsettledOnly} onChange={(e) => setUnsettledOnly(e.target.checked)} />
              Unsettled only
            </label>
            {filtersActive && (
              <button
                type="button"
                className="text-btn"
                onClick={() => {
                  setFilterCategory('all');
                  setFilterPaidBy('all');
                  setUnsettledOnly(false);
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
      {error && <p style={{ color: 'var(--owe)', marginBottom: 16 }}>{error}</p>}

      {expenses.length === 0 ? (
        <p className="empty-state">No expenses logged yet.</p>
      ) : filteredExpenses.length === 0 ? (
        <p className="empty-state">No expenses match these filters.</p>
      ) : (
        <div>
          {dayGroups.map((group) => (
            <div key={group.key} className="day-group">
              <div className="day-group-header">
                <span className="day-group-date">{group.heading}</span>
                <span className="amount">{currency} {group.total.toFixed(2)}</span>
              </div>
              {group.items.map((expense) => (
            <div key={expense.id}>
              <div className="ledger-row" style={{ cursor: 'pointer' }} onClick={() => toggleExpand(expense.id)}>
                <div className="row-main">
                  <span className="row-title">{expense.description}</span>
                  <span className="row-sub">
                    <span className="category-badge">{expense.category}</span>
                    {' · paid by '}{memberNames[expense.paidById] ?? 'someone'}
                    {' · '}{formatDateTime(expense.expenseDate)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span className="amount">
                      {expense.currency} {expense.amount}
                    </span>
                    {expense.subtotal != null && (
                      <span className="amount-note">
                        {expense.currency} {expense.subtotal} base
                        {expense.servicePct != null && ` + ${expense.servicePct}% svc`}
                        {expense.taxPct != null && ` + ${expense.taxPct}% tax`}
                      </span>
                    )}
                  </div>
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
                <div className="modal-backdrop" onClick={() => setExpandedId(null)}>
                  <div className="modal" onClick={(e) => e.stopPropagation()}>
                    <h2 className="page-title" style={{ fontSize: 20 }}>{expense.description}</h2>
                    <p className="expense-detail-meta">
                      <span className="category-badge">{expense.category}</span>
                      {' · paid by '}{memberNames[expense.paidById] ?? 'someone'}
                      {' · '}{formatDateTime(expense.expenseDate)}
                    </p>

                    {expense.receiptPhoto && (
                      <a href={expense.receiptPhoto} target="_blank" rel="noreferrer">
                        <img className="receipt-photo-preview" src={expense.receiptPhoto} alt="Receipt" />
                      </a>
                    )}

                    <div className="expense-detail-amount">
                      <span className="amount">{expense.currency} {expense.amount}</span>
                      {expense.subtotal != null && (
                        <span className="amount-note">
                          {expense.currency} {expense.subtotal} base
                          {expense.servicePct != null && ` + ${expense.servicePct}% svc`}
                          {expense.taxPct != null && ` + ${expense.taxPct}% tax`}
                        </span>
                      )}
                    </div>

                    {expense.splits.filter((s) => s.userId !== expense.paidById).length === 0 ? (
                      <p className="split-item">Nobody else owes anything on this one.</p>
                    ) : (
                      <div className="split-breakdown">
                        {expense.splits
                          .filter((s) => s.userId !== expense.paidById)
                          .map((s) => (
                            <div className="split-item" key={s.userId}>
                              <span>
                                {memberNames[s.userId] ?? s.userId} owes {expense.currency} {s.amountOwed}
                              </span>
                              <button
                                type="button"
                                className={`settle-btn ${s.settled ? 'settle-btn-settled' : ''}`}
                                aria-pressed={s.settled}
                                onClick={() => handleToggleSettled(expense, s.userId, !s.settled)}
                              >
                                {s.settled ? '✓ Settled' : 'Mark settled'}
                              </button>
                            </div>
                          ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                      <button type="button" className="text-btn text-btn-danger" onClick={() => handleDelete(expense)}>
                        Delete
                      </button>
                      <button type="button" className="btn btn-outline" onClick={() => startEdit(expense)}>
                        Edit
                      </button>
                      <button type="button" className="btn" onClick={() => setExpandedId(null)}>
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {editingId === expense.id && (
                <div className="modal-backdrop" onClick={() => setEditingId(null)}>
                  <div className="modal" onClick={(e) => e.stopPropagation()}>
                    <h2 className="page-title" style={{ fontSize: 20 }}>Edit expense</h2>
                    <div className="expense-form">
                      <input
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Name"
                      />

                      <div className="receipt-photo-row">
                        {editReceiptPhoto && <img className="receipt-photo-thumb" src={editReceiptPhoto} alt="" />}
                        <label className="btn btn-outline" style={{ cursor: 'pointer' }}>
                          {editReceiptPhoto ? 'Change receipt photo' : 'Add receipt photo'}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleEditReceiptFile(e.target.files?.[0] ?? null)}
                            style={{ display: 'none' }}
                          />
                        </label>
                        {editReceiptPhoto && (
                          <button type="button" className="text-btn text-btn-danger" onClick={() => setEditReceiptPhoto(null)}>
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="expense-form-row">
                        <input
                          placeholder={editAmountMode === 'base' ? `Base fare (${currency})` : `Total (${currency})`}
                          inputMode="decimal"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="expense-amount-input"
                        />
                        <div className="segmented-control">
                          <button
                            type="button"
                            className={editAmountMode === 'base' ? 'active' : ''}
                            onClick={() => setEditAmountMode('base')}
                          >
                            Base fare
                          </button>
                          <button
                            type="button"
                            className={editAmountMode === 'total' ? 'active' : ''}
                            onClick={() => setEditAmountMode('total')}
                          >
                            Total (tax incl.)
                          </button>
                        </div>
                      </div>

                      {editAmountMode === 'base' && (
                        <div className="expense-form-row">
                          <label className="field-label">
                            Service %
                            <input inputMode="decimal" value={editServicePct} onChange={(e) => setEditServicePct(e.target.value)} />
                          </label>
                          <label className="field-label">
                            Tax %
                            <input inputMode="decimal" value={editTaxPct} onChange={(e) => setEditTaxPct(e.target.value)} />
                          </label>
                        </div>
                      )}

                      {editAmountMode === 'base' && Number(editAmount) > 0 && (
                        <p className="expense-total-preview">Total (incl. tax): {currency} {editTotal.toFixed(2)}</p>
                      )}

                      <div className="expense-form-row">
                        <label className="field-label">
                          Paid by
                          <select value={editPaidById} onChange={(e) => setEditPaidById(e.target.value)}>
                            {memberIds.map((id) => (
                              <option key={id} value={id}>{memberNames[id] ?? id}</option>
                            ))}
                          </select>
                        </label>
                        <label className="field-label">
                          Category
                          <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
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
                          value={editExpenseDate}
                          onChange={(e) => setEditExpenseDate(e.target.value)}
                          min={minExpenseDate}
                          max={maxExpenseDate}
                        />
                      </label>

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
                          total={editAmountMode === 'base' ? Number(editAmount) || 0 : editTotal}
                          taxMultiplier={editMultiplier}
                          currency={currency}
                          mode={editSplitMode}
                          onModeChange={setEditSplitMode}
                          amounts={editCustomAmounts}
                          onAmountsChange={setEditCustomAmounts}
                        />
                      )}

                      {error && <p style={{ color: 'var(--owe)', margin: 0 }}>{error}</p>}

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                        <button type="button" className="btn btn-outline" onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                        <button type="button" className="btn" onClick={() => handleSaveEdit(expense)}>
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <CategoryPieChart expenses={filteredExpenses} currency={currency} />

      {showAddModal && (
        <AddExpenseModal
          tripId={tripId}
          memberIds={memberIds}
          memberNames={memberNames}
          currency={currency}
          currentUserId={currentUserId}
          minExpenseDate={minExpenseDate}
          maxExpenseDate={maxExpenseDate}
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
            onChange();
          }}
        />
      )}
    </div>
  );
}
