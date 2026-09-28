import { useEffect, useRef, useState } from 'react';
import { CaretRight, DownloadSimple, MagnifyingGlass, Plus, Receipt } from '@phosphor-icons/react';
import { EXPENSE_CATEGORIES } from '@travel-planner/shared';
import { api, type Expense } from '../api';
import { categoryColor, categoryIcon } from '../expenseCategoryStyle';
import { dateKey, formatDayHeading, formatMoney } from '../format';
import { ExpenseDetail, ExpensePanel } from './ExpensePanel';
import { ExpenseForm } from './ExpenseForm';
import { expenseDateBounds } from './expenseShared';

/** How long "Undo" stays offered before a deletion is sent to the server. */
const UNDO_MS = 5000;

type PanelState = { kind: 'add' } | { kind: 'view'; id: string } | { kind: 'edit'; id: string } | null;

/** Groups expenses by calendar day (in the viewer's local time), preserving
 *  first-seen order, each with its day heading and spending total. */
function groupByDay(expenses: Expense[]): Array<{ key: string; heading: string; items: Expense[]; total: number }> {
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

/** Splits someone other than the payer still owes. */
const openSplits = (e: Expense) => e.splits.filter((s) => s.userId !== e.paidById && !s.settled);

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
  budget,
  currentUserId,
  tripStartDate,
  tripEndDate,
  onChange,
}: {
  tripId: string;
  expenses: Expense[];
  memberNames: Record<string, string>;
  currency: string;
  budget?: string | null;
  currentUserId?: string;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
  onChange: () => void;
}) {
  const memberIds = Object.keys(memberNames);
  // Bounds for the expense date pickers, so logged expenses stay within the trip's travel dates.
  const { min: minExpenseDate, max: maxExpenseDate } = expenseDateBounds(tripStartDate, tripEndDate);

  const [panel, setPanel] = useState<PanelState>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPaidBy, setFilterPaidBy] = useState('all');
  const [unsettledOnly, setUnsettledOnly] = useState(false);
  // A deletion waiting out its undo window; it's already hidden from the list.
  const [deleted, setDeleted] = useState<Expense | null>(null);
  const deleteTimer = useRef<number | undefined>(undefined);
  const flushDelete = useRef<() => void>(() => {});

  // Leaving the tab mid-undo still deletes the expense.
  useEffect(() => () => flushDelete.current(), []);

  const visible = expenses.filter((e) => e.id !== deleted?.id);
  const query = search.trim().toLowerCase();
  const filtered = visible.filter((e) => {
    if (query && !e.description.toLowerCase().includes(query)) return false;
    if (filterCategory !== 'all' && e.category !== filterCategory) return false;
    if (filterPaidBy !== 'all' && e.paidById !== filterPaidBy) return false;
    if (unsettledOnly && openSplits(e).length === 0) return false;
    return true;
  });
  const filtersActive = query !== '' || filterCategory !== 'all' || filterPaidBy !== 'all' || unsettledOnly;
  const clearFilters = () => {
    setSearch('');
    setFilterCategory('all');
    setFilterPaidBy('all');
    setUnsettledOnly(false);
  };
  const dayGroups = groupByDay(filtered);

  const money = (amount: number) => formatMoney(amount, currency);
  const name = (id: string) => (id === currentUserId ? 'You' : (memberNames[id] ?? 'Former member'));
  const panelExpense = panel && panel.kind !== 'add' ? expenses.find((e) => e.id === panel.id) : undefined;

  const handleToggleSettled = async (expense: Expense, splitUserId: string, settled: boolean) => {
    try {
      await api.setSplitSettled(tripId, expense.id, splitUserId, settled);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update settlement');
    }
  };

  const handleDelete = (expense: Expense) => {
    flushDelete.current();
    setPanel(null);
    setDeleted(expense);
    const send = () => {
      window.clearTimeout(deleteTimer.current);
      flushDelete.current = () => {};
      api
        .deleteExpense(tripId, expense.id)
        .then(onChange)
        .catch((err) => setError(err instanceof Error ? err.message : 'Could not delete expense'))
        .finally(() => setDeleted((d) => (d?.id === expense.id ? null : d)));
    };
    flushDelete.current = send;
    deleteTimer.current = window.setTimeout(send, UNDO_MS);
  };

  const undoDelete = () => {
    window.clearTimeout(deleteTimer.current);
    flushDelete.current = () => {};
    setDeleted(null);
  };

  const formProps = {
    tripId,
    memberIds,
    memberNames,
    currency,
    currentUserId,
    minExpenseDate,
    maxExpenseDate,
  };

  return (
    <div className="expenses">
      {visible.length > 0 && (
        <ExpenseSummary expenses={visible} currency={currency} budget={budget} currentUserId={currentUserId} />
      )}

      <div className="expenses-toolbar no-print">
        <button type="button" className="btn btn-icon" onClick={() => setPanel({ kind: 'add' })}>
          <Plus size={16} weight="bold" aria-hidden /> Add expense
        </button>
        {visible.length > 0 && (
          <>
            <label className="expenses-search">
              <MagnifyingGlass size={16} aria-hidden />
              <span className="visually-hidden">Search expenses</span>
              <input
                type="search"
                placeholder="Search expenses"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="text-btn expenses-export"
              onClick={() => exportExpensesCsv(filtered, memberNames)}
            >
              <DownloadSimple size={15} aria-hidden /> Export CSV
            </button>
          </>
        )}
      </div>

      {visible.length > 0 && (
        <div className="filter-row expenses-filters no-print">
          <div className="filter-select-wrap">
            <select aria-label="Category" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="all">All categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-select-wrap">
            <select aria-label="Paid by" value={filterPaidBy} onChange={(e) => setFilterPaidBy(e.target.value)}>
              <option value="all">Paid by anyone</option>
              {memberIds.map((id) => (
                <option key={id} value={id}>
                  Paid by {name(id) === 'You' ? 'you' : name(id)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className={`filter-pill${unsettledOnly ? ' active' : ''}`}
            aria-pressed={unsettledOnly}
            onClick={() => setUnsettledOnly((v) => !v)}
          >
            Unsettled
          </button>
          {filtersActive && (
            <button type="button" className="text-btn" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      {visible.length === 0 ? (
        <div className="expenses-empty">
          <Receipt size={40} weight="duotone" aria-hidden />
          <h3>No expenses yet</h3>
          <p>Log what the group spends, and we'll work out who owes whom.</p>
          <button type="button" className="btn btn-icon" onClick={() => setPanel({ kind: 'add' })}>
            <Plus size={16} weight="bold" aria-hidden /> Log the first expense
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="expenses-empty expenses-empty-compact">
          <p>No expenses match these filters.</p>
          <button type="button" className="btn btn-outline btn-sm" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        dayGroups.map((group) => (
          <section key={group.key} className="day-group" aria-labelledby={`day-${group.key}`}>
            <header className="day-group-header">
              <h3 className="day-group-date" id={`day-${group.key}`}>
                {group.heading}
              </h3>
              <span className="amount">{money(group.total)}</span>
            </header>
            <ul className="expense-list">
              {group.items.map((expense) => (
                <li key={expense.id}>
                  <ExpenseRow
                    expense={expense}
                    payer={name(expense.paidById)}
                    onOpen={() => setPanel({ kind: 'view', id: expense.id })}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {panel?.kind === 'add' && (
        <ExpensePanel title="Log expense" onClose={() => setPanel(null)}>
          <ExpenseForm
            {...formProps}
            onCancel={() => setPanel(null)}
            onSaved={() => {
              setPanel(null);
              onChange();
            }}
          />
        </ExpensePanel>
      )}
      {panel?.kind === 'view' && panelExpense && (
        <ExpensePanel title={panelExpense.description} onClose={() => setPanel(null)}>
          <ExpenseDetail
            expense={panelExpense}
            memberNames={memberNames}
            currentUserId={currentUserId}
            onToggleSettled={(userId, settled) => handleToggleSettled(panelExpense, userId, settled)}
            onEdit={() => setPanel({ kind: 'edit', id: panelExpense.id })}
            onDelete={() => handleDelete(panelExpense)}
          />
        </ExpensePanel>
      )}
      {panel?.kind === 'edit' && panelExpense && (
        <ExpensePanel title="Edit expense" onClose={() => setPanel(null)}>
          <ExpenseForm
            {...formProps}
            expense={panelExpense}
            onCancel={() => setPanel({ kind: 'view', id: panelExpense.id })}
            onSaved={() => {
              setPanel({ kind: 'view', id: panelExpense.id });
              onChange();
            }}
          />
        </ExpensePanel>
      )}

      <div className="undo-toast" role="status">
        {deleted && (
          <>
            <span>Deleted “{deleted.description}”</span>
            <button type="button" className="text-btn" onClick={undoDelete}>
              Undo
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ExpenseRow({ expense, payer, onOpen }: { expense: Expense; payer: string; onOpen: () => void }) {
  const CategoryIcon = categoryIcon(expense.category);
  const others = expense.splits.filter((s) => s.userId !== expense.paidById);
  const owing = openSplits(expense).length;
  const time = new Date(expense.expenseDate).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return (
    <button type="button" className="expense-row" onClick={onOpen}>
      <span className="expense-cat-icon" style={{ color: categoryColor(expense.category) }} aria-hidden="true">
        <CategoryIcon size={18} weight="duotone" />
      </span>
      <span className="expense-row-main">
        <span className="expense-row-title">{expense.description}</span>
        <span className="expense-row-sub">
          {expense.category} · {time} · {payer === 'You' ? 'You paid' : `${payer} paid`}
          {expense.receiptPhoto && (
            <>
              {' · '}
              <Receipt size={13} aria-label="Has receipt" className="expense-row-receipt" />
            </>
          )}
        </span>
      </span>
      <span className="expense-row-end">
        <span className="expense-row-amount amount">{formatMoney(Number(expense.amount), expense.currency)}</span>
        {others.length > 0 && (
          <span className={`expense-status${owing ? ' is-open' : ' is-settled'}`}>
            {owing ? `${owing} ${owing === 1 ? 'owes' : 'owe'}` : 'Settled'}
          </span>
        )}
      </span>
      <CaretRight size={14} aria-hidden className="expense-row-caret" />
    </button>
  );
}

/** Headline numbers for the whole trip, plus where the money went by category. */
function ExpenseSummary({
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
  const money = (amount: number) => formatMoney(amount, currency);
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const myShare = expenses.reduce(
    (sum, e) => sum + e.splits.filter((s) => s.userId === currentUserId).reduce((a, s) => a + Number(s.amountOwed), 0),
    0,
  );
  const unsettled = expenses.reduce((sum, e) => sum + openSplits(e).reduce((a, s) => a + Number(s.amountOwed), 0), 0);
  const budgetNum = budget != null ? Number(budget) : null;
  const budgetPct = budgetNum ? (total / budgetNum) * 100 : null;

  const byCategory = [...EXPENSE_CATEGORIES, ...new Set(expenses.map((e) => e.category))]
    .filter((cat, i, all) => all.indexOf(cat) === i)
    .map((cat) => ({
      cat,
      amount: expenses.filter((e) => e.category === cat).reduce((sum, e) => sum + Number(e.amount), 0),
    }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return (
    <section className="expense-summary card" aria-label="Spending summary">
      <dl className="expense-summary-stats">
        <div className="expense-stat expense-stat-lead">
          <dt>Trip total</dt>
          <dd className="amount">{money(total)}</dd>
        </div>
        {currentUserId && (
          <div className="expense-stat">
            <dt>Your share</dt>
            <dd className="amount">{money(myShare)}</dd>
          </div>
        )}
        <div className="expense-stat">
          <dt>Still to settle</dt>
          <dd className={`amount${unsettled > 0.005 ? ' is-open' : ''}`}>{unsettled > 0.005 ? money(unsettled) : 'All settled'}</dd>
        </div>
      </dl>

      {budgetPct != null && budgetNum != null && (
        <div className="expense-budget">
          <div className="expense-budget-label">
            <span>
              {Math.round(budgetPct)}% of {money(budgetNum)} budget
            </span>
            <span className={budgetPct > 100 ? 'is-over' : ''}>
              {budgetPct > 100 ? `${money(total - budgetNum)} over` : `${money(budgetNum - total)} left`}
            </span>
          </div>
          <progress
            className={budgetPct > 100 ? 'is-over' : ''}
            max={100}
            value={Math.min(budgetPct, 100)}
            aria-label="Budget used"
          />
        </div>
      )}

      <div className="expense-mix">
        <div className="expense-mix-bar" aria-hidden="true">
          {byCategory.map((c) => (
            <span key={c.cat} style={{ flexGrow: c.amount, background: categoryColor(c.cat) }} />
          ))}
        </div>
        <ul className="expense-mix-legend" aria-label="Spending by category">
          {byCategory.map((c) => (
            <li key={c.cat}>
              <span className="expense-mix-dot" style={{ background: categoryColor(c.cat) }} aria-hidden="true" />
              {c.cat}
              <span className="amount">{money(c.amount)}</span>
              <span className="expense-mix-pct">{Math.round((c.amount / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
