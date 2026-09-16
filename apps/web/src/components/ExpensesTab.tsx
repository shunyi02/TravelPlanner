import { useState } from 'react';
import type { Expense } from '../api';
import { api } from '../api';

export function ExpensesTab({
  tripId,
  expenses,
  memberNames,
  onChange,
}: {
  tripId: string;
  expenses: Expense[];
  memberNames: Record<string, string>;
  onChange: () => void;
}) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(amount);
    if (!description.trim() || !parsed || parsed <= 0) return;
    // Splits evenly across all trip members by default. Custom per-person
    // shares are supported by the API (see CreateExpenseDto) but not yet
    // exposed in this UI.
    await api.createExpense(tripId, { description: description.trim(), amount: parsed });
    setDescription('');
    setAmount('');
    onChange();
  };

  return (
    <div>
      {expenses.length === 0 ? (
        <p className="empty-state">No expenses logged yet.</p>
      ) : (
        <div>
          {expenses.map((expense) => (
            <div className="ledger-row" key={expense.id}>
              <div className="row-main">
                <span className="row-title">{expense.description}</span>
                <span className="row-sub">paid by {memberNames[expense.paidById] ?? 'someone'}</span>
              </div>
              <span className="amount">
                {expense.currency} {expense.amount}
              </span>
            </div>
          ))}
        </div>
      )}
      <form className="form-inline" onSubmit={handleAdd}>
        <input
          placeholder="What was it for?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          placeholder="Amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ maxWidth: 120 }}
        />
        <button className="btn" type="submit">
          Log expense
        </button>
      </form>
    </div>
  );
}
