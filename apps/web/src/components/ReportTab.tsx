import { useEffect, useState } from 'react';
import type { Balance } from '@travel-planner/shared';
import { EXPENSE_CATEGORIES } from '@travel-planner/shared';
import type { Expense, TripDetail } from '../api';
import { api } from '../api';
import { hueForIndex } from '../palette';
import { PieChart, type PieSlice } from './PieChart';
import { SpendOverTimeChart } from './SpendOverTimeChart';

function BudgetCard({
  tripId,
  budget,
  spent,
  currency,
  onChange,
}: {
  tripId: string;
  budget: string | null;
  spent: number;
  currency: string;
  onChange: () => void;
}) {
  const [input, setInput] = useState(budget ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const parsed = input.trim() === '' ? null : Number(input);
      if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
        setError('Enter a valid amount, or leave blank to clear the budget.');
        return;
      }
      await api.updateTrip(tripId, { budget: parsed });
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save budget');
    } finally {
      setSaving(false);
    }
  };

  const budgetNum = budget != null ? Number(budget) : null;

  return (
    <div className="report-card">
      <p className="sidebar-section-label">Budget</p>
      {budgetNum != null ? (
        <>
          <div className="report-budget-bar-track">
            <div
              className="report-budget-bar-fill"
              style={{
                width: `${Math.min(100, (spent / budgetNum) * 100)}%`,
                background: spent > budgetNum ? 'var(--owe)' : 'var(--route)',
              }}
            />
          </div>
          <p className="report-budget-line">
            {currency} {spent.toFixed(2)} spent of {currency} {budgetNum.toFixed(2)}
            {spent > budgetNum
              ? ` · ${currency} ${(spent - budgetNum).toFixed(2)} over`
              : ` · ${currency} ${(budgetNum - spent).toFixed(2)} left`}
          </p>
        </>
      ) : (
        <p className="empty-state" style={{ margin: '4px 0 12px' }}>No budget set for this trip.</p>
      )}
      <form className="form-inline no-print" style={{ marginTop: budgetNum != null ? 12 : 0 }} onSubmit={handleSave}>
        <input
          inputMode="decimal"
          placeholder={`Budget (${currency})`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ maxWidth: 160 }}
        />
        <button className="btn btn-outline" type="submit" disabled={saving}>
          {budgetNum != null ? 'Update' : 'Set budget'}
        </button>
      </form>
      {error && <p style={{ color: 'var(--owe)', margin: '8px 0 0' }}>{error}</p>}
    </div>
  );
}

/** Full expense report for a trip: totals, budget tracking, a per-member
 *  breakdown, a category × member matrix, settlement progress, and spend
 *  over time. Net balances come from the same endpoint as the Balances
 *  tab, so the two never disagree about who owes what. */
export function ReportTab({
  tripId,
  trip,
  expenses,
  memberNames,
  onChange,
}: {
  tripId: string;
  trip: TripDetail;
  expenses: Expense[];
  memberNames: Record<string, string>;
  onChange: () => void;
}) {
  const currency = trip.currency;
  const [balances, setBalances] = useState<Balance[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    api
      .getBalances(tripId)
      .then(setBalances)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load balances'));
  }, [tripId]);

  const memberIds = Object.keys(memberNames);

  if (expenses.length === 0) {
    return <p className="empty-state">No expenses logged yet — nothing to report.</p>;
  }

  const netByMember = new Map(balances.map((b) => [b.userId, b.amount]));
  const paidByMember = new Map<string, number>();
  const paidCountByMember = new Map<string, number>();
  const shareByMember = new Map<string, number>();
  // categoryByMember[category][userId] = that member's share of that category.
  const categoryByMember = new Map<string, Map<string, number>>();
  let settledTotal = 0;
  let outstandingTotal = 0;

  for (const expense of expenses) {
    const amount = Number(expense.amount);
    paidByMember.set(expense.paidById, (paidByMember.get(expense.paidById) ?? 0) + amount);
    paidCountByMember.set(expense.paidById, (paidCountByMember.get(expense.paidById) ?? 0) + 1);

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
  const categoriesPresent = EXPENSE_CATEGORIES.filter((cat) => categoryByMember.has(cat));

  const memberSlices: PieSlice[] = memberIds
    .map((id, i) => ({
      key: id,
      label: memberNames[id] ?? id,
      amount: paidByMember.get(id) ?? 0,
      color: hueForIndex(i),
    }))
    .filter((s) => s.amount > 0);

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-outline" onClick={() => window.print()}>
          Export PDF
        </button>
      </div>

      <div className="report-summary">
        <div className="report-stat">
          <span className="report-stat-value">
            {currency} {grandTotal.toFixed(2)}
          </span>
          <span className="report-stat-label">Total spend</span>
        </div>
        <div className="report-stat">
          <span className="report-stat-value">{expenses.length}</span>
          <span className="report-stat-label">Expenses logged</span>
        </div>
        <div className="report-stat">
          <span className="report-stat-value">
            {currency} {(grandTotal / (memberIds.length || 1)).toFixed(2)}
          </span>
          <span className="report-stat-label">Average share per member</span>
        </div>
      </div>

      <BudgetCard tripId={tripId} budget={trip.budget} spent={grandTotal} currency={currency} onChange={onChange} />

      <p className="sidebar-section-label">By member</p>
      {error && <p className="empty-state">Couldn't load balances: {error}</p>}
      <div>
        {memberIds.map((id) => {
          const paid = paidByMember.get(id) ?? 0;
          const paidCount = paidCountByMember.get(id) ?? 0;
          const share = shareByMember.get(id) ?? 0;
          const net = netByMember.get(id) ?? 0;
          return (
            <div className="ledger-row" key={id}>
              <div className="row-main">
                <span className="row-title">{memberNames[id] ?? id}</span>
                <span className="row-sub">
                  paid {currency} {paid.toFixed(2)} ({paidCount} expense{paidCount === 1 ? '' : 's'}) · share {currency}{' '}
                  {share.toFixed(2)}
                </span>
              </div>
              <span className={`amount ${net > 0 ? 'owed-to-you' : net < 0 ? 'you-owe' : ''}`}>
                {Math.abs(net) < 0.005 ? 'settled up' : `${net > 0 ? 'is owed ' : 'owes '}${currency} ${Math.abs(net).toFixed(2)}`}
              </span>
            </div>
          );
        })}
      </div>

      {sharedTotal > 0.005 && (
        <div className="report-card">
          <p className="sidebar-section-label">Settlement status</p>
          <div className="report-budget-bar-track">
            <div className="report-budget-bar-fill" style={{ width: `${(settledTotal / sharedTotal) * 100}%`, background: 'var(--route)' }} />
          </div>
          <p className="report-budget-line">
            {currency} {settledTotal.toFixed(2)} settled of {currency} {sharedTotal.toFixed(2)} owed between members
            {' · '}
            {currency} {outstandingTotal.toFixed(2)} outstanding
          </p>
        </div>
      )}

      {categoriesPresent.length > 0 && (
        <div className="report-card">
          <p className="sidebar-section-label">By category &amp; member</p>
          <div className="report-matrix-scroll">
            <table className="report-matrix">
              <thead>
                <tr>
                  <th>Category</th>
                  {memberIds.map((id) => (
                    <th key={id}>{memberNames[id] ?? id}</th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {categoriesPresent.map((cat) => {
                  const row = categoryByMember.get(cat)!;
                  const rowTotal = [...row.values()].reduce((sum, v) => sum + v, 0);
                  return (
                    <tr key={cat}>
                      <td>{cat}</td>
                      {memberIds.map((id) => (
                        <td key={id}>{(row.get(id) ?? 0) > 0 ? (row.get(id) ?? 0).toFixed(2) : '—'}</td>
                      ))}
                      <td className="report-matrix-total">{rowTotal.toFixed(2)}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td className="report-matrix-total">Total</td>
                  {memberIds.map((id) => (
                    <td key={id} className="report-matrix-total">
                      {(shareByMember.get(id) ?? 0).toFixed(2)}
                    </td>
                  ))}
                  <td className="report-matrix-total">{grandTotal.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="report-matrix-note">Amounts are each member's share of that category, in {currency}.</p>
        </div>
      )}

      <PieChart title="Paid by member" ariaLabel="Amount paid by member" slices={memberSlices} currency={currency} />

      <SpendOverTimeChart expenses={expenses} currency={currency} />
    </div>
  );
}
