import { useState } from 'react';
import { ArrowRight, CaretDown, FilePdf, Receipt } from '@phosphor-icons/react';
import { EXPENSE_CATEGORIES } from '@travel-planner/shared';
import type { Expense, TripDetail } from '../api';
import { api } from '../api';
import { useAuth } from '../authContext';
import { dateKey, formatMoney } from '../format';
import { SpendOverTimeChart } from './SpendOverTimeChart';

const DAY_MS = 86_400_000;

/** Every calendar day ("YYYY-MM-DD") from `first` to `last` inclusive. */
function dayRange(first: string, last: string): string[] {
  const days: string[] = [];
  for (let t = Date.parse(`${first}T00:00:00Z`); t <= Date.parse(`${last}T00:00:00Z`); t += DAY_MS) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

function todayKey(): string {
  return dateKey(new Date().toISOString());
}

function BudgetCard({
  tripId,
  budget,
  spent,
  currency,
  daysLeft,
  started,
  onChange,
}: {
  tripId: string;
  budget: string | null;
  spent: number;
  currency: string;
  /** Trip days still ahead (including today), or null once the trip is over. */
  daysLeft: number | null;
  /** Whether the trip has begun, which changes how the per-day hint reads. */
  started: boolean;
  onChange: () => void;
}) {
  const budgetNum = budget != null ? Number(budget) : null;
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(budget ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const money = (n: number) => formatMoney(n, currency);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = input.trim() === '' ? null : Number(input);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      setError('Enter a valid amount, or leave it blank to clear the budget.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.updateTrip(tripId, { budget: parsed });
      setEditing(false);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save budget');
    } finally {
      setSaving(false);
    }
  };

  const form = (
    <form className="report-budget-form no-print" onSubmit={handleSave}>
      <input
        inputMode="decimal"
        placeholder={`Budget (${currency})`}
        aria-label={`Trip budget in ${currency}`}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="report-budget-input"
        autoFocus
      />
      <button className="btn" type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button
        className="text-btn"
        type="button"
        onClick={() => {
          setEditing(false);
          setError(null);
          setInput(budget ?? '');
        }}
      >
        Cancel
      </button>
    </form>
  );

  if (budgetNum == null) {
    return (
      <section className="report-card report-budget" aria-labelledby="budget-heading">
        <div className="report-card-head">
          <h3 className="report-heading" id="budget-heading">
            Budget
          </h3>
        </div>
        {editing ? (
          form
        ) : (
          <div className="report-budget-empty">
            <p>Set a budget to see how much is left as you go.</p>
            <button className="btn btn-outline no-print" onClick={() => setEditing(true)}>
              Set a budget
            </button>
          </div>
        )}
        {error && <p className="form-error spaced-above">{error}</p>}
      </section>
    );
  }

  const over = spent > budgetNum;
  const pctUsed = budgetNum > 0 ? (spent / budgetNum) * 100 : 100;
  const remaining = budgetNum - spent;

  return (
    <section className={`report-card report-budget${over ? ' report-budget-over' : ''}`} aria-labelledby="budget-heading">
      <div className="report-card-head">
        <h3 className="report-heading" id="budget-heading">
          Budget
        </h3>
        {!editing && (
          <button className="text-btn no-print" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>

      <div className="report-budget-headline">
        <span className="report-budget-big">
          {over ? `Over by ${money(-remaining)}` : `${money(remaining)} left`}
        </span>
        <span className="report-budget-pct">{Math.round(pctUsed)}% used</span>
      </div>

      <div
        className="report-meter"
        role="meter"
        aria-label="Budget used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Math.round(pctUsed))}
      >
        <div className="report-meter-fill" style={{ width: `${Math.min(100, pctUsed)}%` }} />
      </div>

      <p className="report-note">
        {money(spent)} spent of {money(budgetNum)}
        {!over && daysLeft != null && daysLeft > 0 && (
          <>
            {' · '}about {money(remaining / daysLeft)} a day{' '}
            {started
              ? `for the ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`
              : `across the trip's ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`}
          </>
        )}
      </p>

      {editing && form}
      {error && <p className="form-error spaced-above">{error}</p>}
    </section>
  );
}

/** A trip's expense report: headline numbers, budget, where the money went,
 *  spend per day, and what each member paid versus used. Who owes whom lives
 *  on the Balances tab; this links there rather than repeating it. */
export function ReportTab({
  tripId,
  trip,
  expenses,
  memberNames,
  onChange,
  onGoToExpenses,
  onGoToBalances,
}: {
  tripId: string;
  trip: TripDetail;
  expenses: Expense[];
  memberNames: Record<string, string>;
  onChange: () => void;
  onGoToExpenses: () => void;
  onGoToBalances: () => void;
}) {
  const { currentUser } = useAuth();
  const [showBreakdown, setShowBreakdown] = useState(false);
  const currency = trip.currency;
  const money = (n: number) => formatMoney(n, currency);

  if (expenses.length === 0) {
    return (
      <div className="balances-state">
        <Receipt size={36} weight="duotone" aria-hidden />
        <h3>No report yet</h3>
        <p>Log the first expense and this fills in with totals, budget and charts.</p>
        <button type="button" className="btn" onClick={onGoToExpenses}>
          Log an expense
        </button>
      </div>
    );
  }

  const memberIds = Object.keys(memberNames);
  const name = (id: string) => memberNames[id] ?? 'Former member';

  const paidByMember = new Map<string, number>();
  const shareByMember = new Map<string, number>();
  const totalByCategory = new Map<string, number>();
  // categoryByMember[category][userId] = that member's share of that category.
  const categoryByMember = new Map<string, Map<string, number>>();
  const totalByDay = new Map<string, number>();
  let settledTotal = 0;
  let outstandingTotal = 0;

  for (const expense of expenses) {
    const amount = Number(expense.amount);
    paidByMember.set(expense.paidById, (paidByMember.get(expense.paidById) ?? 0) + amount);
    totalByCategory.set(expense.category, (totalByCategory.get(expense.category) ?? 0) + amount);
    const day = dateKey(expense.expenseDate);
    totalByDay.set(day, (totalByDay.get(day) ?? 0) + amount);

    const categoryRow = categoryByMember.get(expense.category) ?? new Map<string, number>();
    categoryByMember.set(expense.category, categoryRow);
    for (const split of expense.splits) {
      const owed = Number(split.amountOwed);
      shareByMember.set(split.userId, (shareByMember.get(split.userId) ?? 0) + owed);
      categoryRow.set(split.userId, (categoryRow.get(split.userId) ?? 0) + owed);
      if (split.userId !== expense.paidById) {
        if (split.settled) settledTotal += owed;
        else outstandingTotal += owed;
      }
    }
  }

  const grandTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const sharedTotal = settledTotal + outstandingTotal;

  // The chart spans the whole trip (plus any expense logged outside it), so
  // days with no spending still show up as days.
  const expenseDays = [...totalByDay.keys()].sort();
  const firstDay = [trip.startDate?.slice(0, 10), expenseDays[0]].filter(Boolean).sort()[0]!;
  const lastDay = [trip.endDate?.slice(0, 10), expenseDays[expenseDays.length - 1]].filter(Boolean).sort().at(-1)!;
  const days = dayRange(firstDay, lastDay);
  const perDay = grandTotal / days.length;

  const today = todayKey();
  const tripEnd = trip.endDate?.slice(0, 10);
  const tripStart = trip.startDate?.slice(0, 10);
  const daysLeft =
    tripStart && tripEnd && today <= tripEnd ? dayRange(today > tripStart ? today : tripStart, tripEnd).length : null;

  const categories = [...totalByCategory.entries()].sort((a, b) => b[1] - a[1]);
  const [topCategory, topCategoryAmount] = categories[0];
  const maxCategory = topCategoryAmount;
  const matrixCategories = EXPENSE_CATEGORIES.filter((cat) => categoryByMember.has(cat));

  const myShare = currentUser ? shareByMember.get(currentUser.id) ?? 0 : null;
  const perPerson = grandTotal / (memberIds.length || 1);

  const memberRows = memberIds
    .map((id) => ({ id, paid: paidByMember.get(id) ?? 0, used: shareByMember.get(id) ?? 0 }))
    .sort((a, b) => b.paid - a.paid);
  const maxMember = Math.max(...memberRows.flatMap((r) => [r.paid, r.used]), 0.01);

  return (
    <div className="report">
      <div className="report-head">
        <h2 className="report-title">Trip report</h2>
        <button className="btn btn-outline report-export no-print" onClick={() => window.print()}>
          <FilePdf size={17} aria-hidden /> Export PDF
        </button>
      </div>

      <div className="report-tiles">
        <div className="report-tile">
          <span className="report-tile-value">{money(grandTotal)}</span>
          <span className="report-tile-label">
            spent · {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}
          </span>
        </div>
        <div className="report-tile">
          <span className="report-tile-value">{money(perDay)}</span>
          <span className="report-tile-label">
            per day · over {days.length} {days.length === 1 ? 'day' : 'days'}
          </span>
        </div>
        <div className="report-tile">
          <span className="report-tile-value">{money(myShare ?? perPerson)}</span>
          <span className="report-tile-label">
            {myShare != null ? `your share · avg ${money(perPerson)} each` : 'per person'}
          </span>
        </div>
        <div className="report-tile">
          <span className="report-tile-value report-tile-value-text">{topCategory}</span>
          <span className="report-tile-label">top category · {Math.round((topCategoryAmount / grandTotal) * 100)}% of spend</span>
        </div>
      </div>

      <BudgetCard
        key={trip.budget ?? 'none'}
        tripId={tripId}
        budget={trip.budget}
        spent={grandTotal}
        currency={currency}
        daysLeft={daysLeft}
        started={!tripStart || today >= tripStart}
        onChange={onChange}
      />

      <section className="report-card" aria-labelledby="categories-heading">
        <div className="report-card-head">
          <h3 className="report-heading" id="categories-heading">
            Where the money went
          </h3>
        </div>
        <ul className="report-hbars">
          {categories.map(([cat, amount]) => (
            <li className="report-hbar-row" key={cat}>
              <span className="report-hbar-label">{cat}</span>
              <span className="report-hbar-track" aria-hidden="true">
                <span className="report-hbar-fill" style={{ width: `${Math.max((amount / maxCategory) * 100, 1.5)}%` }} />
              </span>
              <span className="report-hbar-value amount">{money(amount)}</span>
              <span className="report-hbar-pct amount">{Math.round((amount / grandTotal) * 100)}%</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="text-btn report-disclosure no-print"
          aria-expanded={showBreakdown}
          aria-controls="category-breakdown"
          onClick={() => setShowBreakdown((v) => !v)}
        >
          <CaretDown size={14} aria-hidden className="report-disclosure-caret" />
          {showBreakdown ? 'Hide' : 'Show'} per-member breakdown
        </button>

        {/* Always rendered so it prints; hidden on screen until expanded. */}
        <div id="category-breakdown" className={`report-breakdown${showBreakdown ? ' open' : ''}`}>
          <div className="report-matrix-scroll">
            <table className="report-matrix">
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  {memberIds.map((id) => (
                    <th scope="col" key={id}>
                      {name(id)}
                    </th>
                  ))}
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {matrixCategories.map((cat) => {
                  const row = categoryByMember.get(cat)!;
                  return (
                    <tr key={cat}>
                      <th scope="row">{cat}</th>
                      {memberIds.map((id) => {
                        const v = row.get(id) ?? 0;
                        return <td key={id}>{v > 0 ? money(v) : '—'}</td>;
                      })}
                      <td className="report-matrix-total">{money(totalByCategory.get(cat) ?? 0)}</td>
                    </tr>
                  );
                })}
                <tr className="report-matrix-foot">
                  <th scope="row">Total</th>
                  {memberIds.map((id) => (
                    <td key={id} className="report-matrix-total">
                      {money(shareByMember.get(id) ?? 0)}
                    </td>
                  ))}
                  <td className="report-matrix-total">{money(grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="report-note">Each member's share of each category.</p>
        </div>
      </section>

      <SpendOverTimeChart days={days} totalByDay={totalByDay} average={perDay} currency={currency} />

      <section className="report-card" aria-labelledby="members-heading">
        <div className="report-card-head">
          <h3 className="report-heading" id="members-heading">
            Paid vs. used
          </h3>
          <button className="text-btn report-link no-print" onClick={onGoToBalances}>
            See who owes whom <ArrowRight size={14} aria-hidden />
          </button>
        </div>
        <p className="report-note report-note-top">
          What each person paid for, next to their share of what was spent. The difference is what the Balances tab settles.
        </p>
        <ul className="report-members">
          {memberRows.map(({ id, paid, used }) => (
            <li className="report-member" key={id}>
              <span className="report-member-name">
                {name(id)}
                {id === currentUser?.id && <span className="report-you"> (you)</span>}
              </span>
              <span className="report-member-bars">
                <span className="report-member-bar-row">
                  <span className="report-member-bar-key">Paid</span>
                  <span className="report-hbar-track" aria-hidden="true">
                    <span className="report-hbar-fill" style={{ width: `${paid > 0 ? Math.max((paid / maxMember) * 100, 1.5) : 0}%` }} />
                  </span>
                  <span className="report-hbar-value amount">{money(paid)}</span>
                </span>
                <span className="report-member-bar-row">
                  <span className="report-member-bar-key">Used</span>
                  <span className="report-hbar-track" aria-hidden="true">
                    <span
                      className="report-hbar-fill report-hbar-fill-used"
                      style={{ width: `${used > 0 ? Math.max((used / maxMember) * 100, 1.5) : 0}%` }}
                    />
                  </span>
                  <span className="report-hbar-value amount">{money(used)}</span>
                </span>
              </span>
            </li>
          ))}
        </ul>

        {sharedTotal > 0.005 && (
          <div className="report-settled">
            <div className="report-card-head">
              <span className="report-subheading">Paid back so far</span>
              <span className="report-note">{Math.round((settledTotal / sharedTotal) * 100)}%</span>
            </div>
            {settledTotal > 0.005 && (
              <div
                className="report-meter report-meter-thin"
                role="meter"
                aria-label="Paid back so far"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((settledTotal / sharedTotal) * 100)}
              >
                <div className="report-meter-fill" style={{ width: `${(settledTotal / sharedTotal) * 100}%` }} />
              </div>
            )}
            <p className="report-note">
              {settledTotal > 0.005
                ? `${money(settledTotal)} of ${money(sharedTotal)} paid back · ${money(outstandingTotal)} to go`
                : `Nothing paid back yet · ${money(outstandingTotal)} still owed between members`}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
