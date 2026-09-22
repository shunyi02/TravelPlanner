import { useEffect, useState } from 'react';
import type { Balance, Settlement } from '@travel-planner/shared';
import { api } from '../api';

export function BalancesTab({
  tripId,
  memberNames,
  currency,
}: {
  tripId: string;
  memberNames: Record<string, string>;
  currency: string;
}) {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    Promise.all([api.getBalances(tripId), api.getSettlements(tripId)])
      .then(([b, s]) => {
        setBalances(b);
        setSettlements(s);
      })
      .catch((err) => setError(err.message));
  }, [tripId]);

  const name = (id: string) => memberNames[id] ?? id;

  if (error) return <p className="empty-state">Couldn't load balances: {error}</p>;

  return (
    <div>
      {balances.length === 0 ? (
        <p className="empty-state">No expenses to settle yet.</p>
      ) : (
        <div className="card">
          {balances.map((b) => (
            <div className="ledger-row" key={b.userId}>
              <span className="row-title">{name(b.userId)}</span>
              <span className={`amount ${b.amount >= 0 ? 'owed-to-you' : 'you-owe'}`}>
                {b.amount >= 0 ? 'is owed ' : 'owes '}
                {currency} {Math.abs(b.amount).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}

      {settlements.length > 0 && (
        <div className="settlement-note">
          {settlements.map((s, i) => (
            <div key={i}>
              {name(s.fromUserId)} pays {name(s.toUserId)} {currency} {s.amount.toFixed(2)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
