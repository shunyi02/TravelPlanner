import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, CheckCircle, Copy, Receipt } from '@phosphor-icons/react';
import type { Balance, Settlement } from '@travel-planner/shared';
import { api } from '../api';
import { useAuth } from '../authContext';
import { formatMoney, initials } from '../format';

/** Below half a cent, a balance is rounding noise, not money owed. */
const isZero = (amount: number) => Math.abs(amount) < 0.005;

function Avatar({ name, isYou }: { name: string; isYou?: boolean }) {
  return (
    <span className={`balances-avatar${isYou ? ' balances-avatar-you' : ''}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

function BalancesSkeleton() {
  return (
    <div className="balances" aria-busy="true" aria-label="Loading balances">
      <div className="balances-summary balances-skeleton">
        <div className="balances-skeleton-line balances-skeleton-line-short" />
        <div className="balances-skeleton-line balances-skeleton-line-big" />
        <div className="balances-skeleton-line" />
      </div>
      <div className="card balances-skeleton">
        {[0, 1, 2].map((i) => (
          <div className="balances-skeleton-row" key={i} />
        ))}
      </div>
    </div>
  );
}

export function BalancesTab({
  tripId,
  tripName,
  memberNames,
  currency,
  hasExpenses,
  onGoToExpenses,
}: {
  tripId: string;
  tripName: string;
  memberNames: Record<string, string>;
  currency: string;
  hasExpenses: boolean;
  onGoToExpenses: () => void;
}) {
  const { currentUser } = useAuth();
  // null until the first load finishes, so loading never reads as "nothing to settle".
  const [data, setData] = useState<{ balances: Balance[]; settlements: Settlement[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setError(null);
    setData(null);
    Promise.all([api.getBalances(tripId), api.getSettlements(tripId)])
      .then(([balances, settlements]) => setData({ balances, settlements }))
      .catch((err) => setError(err.message));
  }, [tripId]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  if (error) return <p className="empty-state">Couldn't load balances: {error}</p>;
  if (!data) return <BalancesSkeleton />;

  if (!hasExpenses) {
    return (
      <div className="balances-state">
        <Receipt size={36} weight="duotone" aria-hidden />
        <h3>Nothing to settle yet</h3>
        <p>Once someone logs an expense, you'll see who owes whom here.</p>
        <button type="button" className="btn" onClick={onGoToExpenses}>
          Log an expense
        </button>
      </div>
    );
  }

  const meId = currentUser?.id;
  const name = (id: string) => memberNames[id] ?? 'Former member';
  const who = (id: string) => (id === meId ? 'You' : name(id));
  const money = (amount: number) => formatMoney(amount, currency);

  // Every member gets a row, including those who are exactly even.
  const amountById = new Map(data.balances.map((b) => [b.userId, b.amount]));
  const rows = [...new Set([...Object.keys(memberNames), ...amountById.keys()])]
    .map((userId) => ({ userId, amount: amountById.get(userId) ?? 0 }))
    .sort((a, b) => b.amount - a.amount);
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.amount)), 0.01);

  const { settlements } = data;
  const allSquare = settlements.length === 0;
  const myAmount = meId ? amountById.get(meId) ?? 0 : 0;
  const mine = settlements.filter((s) => s.fromUserId === meId || s.toUserId === meId);
  const paymentsLine = `${settlements.length} ${settlements.length === 1 ? 'payment' : 'payments'}`;

  let headline: ReactNode;
  let subline: string;
  let tone: 'owed' | 'owe' | 'even';
  if (allSquare) {
    tone = 'even';
    headline = "Everyone's settled up";
    subline = 'No payments needed. Nice work, team.';
  } else if (!isZero(myAmount) && myAmount > 0) {
    tone = 'owed';
    headline = (
      <>
        You're owed <span className="balances-summary-amount">{money(myAmount)}</span>
      </>
    );
    subline = `${paymentsLine} will settle the whole trip.`;
  } else if (!isZero(myAmount)) {
    tone = 'owe';
    headline = (
      <>
        You owe <span className="balances-summary-amount">{money(-myAmount)}</span>
      </>
    );
    subline =
      mine.length === 1
        ? `Pay ${name(mine[0].toUserId)} to square up.`
        : `Split across ${mine.length} people. ${paymentsLine} settle the whole trip.`;
  } else {
    tone = 'even';
    headline = "You're all square";
    subline = `${paymentsLine} still settle the rest of the group.`;
  }

  const handleCopy = async () => {
    const text = [
      `${tripName}: settle up`,
      ...settlements.map((s) => `• ${name(s.fromUserId)} pays ${name(s.toUserId)} ${money(s.amount)}`),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopyStatus('idle'), 2500);
  };

  return (
    <div className="balances">
      <section className={`balances-summary balances-summary-${tone}`} aria-label="Your balance">
        <div className="balances-summary-text">
          <span className="balances-eyebrow">{allSquare ? 'Trip balance' : 'Your balance'}</span>
          <h2 className="balances-summary-headline">
            {allSquare && <CheckCircle size={30} weight="fill" aria-hidden className="balances-summary-check" />}
            {headline}
          </h2>
          <p className="balances-summary-sub">{subline}</p>
        </div>
        {!allSquare && (
          <div className="balances-copy">
            <button type="button" className="btn btn-outline" onClick={handleCopy}>
              <Copy size={16} aria-hidden /> Copy summary
            </button>
            <span className="balances-copy-status" role="status">
              {copyStatus === 'copied' ? 'Copied. Paste it in your group chat.' : copyStatus === 'failed' ? "Couldn't copy. Try again." : ''}
            </span>
          </div>
        )}
      </section>

      {!allSquare && (
        <section className="balances-section" aria-labelledby="settle-up-heading">
          <h3 className="balances-heading" id="settle-up-heading">
            Settle up
          </h3>
          <ul className="card balances-payments">
            {settlements.map((s, i) => {
              const youPay = s.fromUserId === meId;
              const paysYou = s.toUserId === meId;
              return (
                <li className={`balances-payment${youPay || paysYou ? ' balances-payment-mine' : ''}`} key={i}>
                  <span className="balances-person">
                    <Avatar name={name(s.fromUserId)} isYou={youPay} />
                    <span className="balances-person-name">{who(s.fromUserId)}</span>
                  </span>
                  <ArrowRight size={18} className="balances-payment-arrow" aria-hidden />
                  <span className="visually-hidden">pays</span>
                  <span className="balances-person">
                    <Avatar name={name(s.toUserId)} isYou={paysYou} />
                    <span className="balances-person-name">{who(s.toUserId)}</span>
                  </span>
                  <span className="balances-payment-end">
                    {(youPay || paysYou) && (
                      <span className={`balances-tag ${youPay ? 'balances-tag-owe' : 'balances-tag-owed'}`}>
                        {youPay ? 'You pay' : 'Pays you'}
                      </span>
                    )}
                    <span className="balances-payment-amount amount">{money(s.amount)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="balances-section" aria-labelledby="net-heading">
        <div className="balances-heading-row">
          <h3 className="balances-heading" id="net-heading">
            Who's up, who's down
          </h3>
          <span className="balances-legend" aria-hidden="true">
            <span className="balances-legend-owe">owes</span>
            <span className="balances-legend-axis" />
            <span className="balances-legend-owed">gets back</span>
          </span>
        </div>
        <ul className="card balances-chart">
          {rows.map(({ userId, amount }) => {
            const even = isZero(amount);
            const owed = !even && amount > 0;
            const pct = even ? 0 : Math.max((Math.abs(amount) / maxAbs) * 100, 3);
            const label = even
              ? `${who(userId)} ${userId === meId ? 'are' : 'is'} even`
              : `${who(userId)} ${owed ? 'gets back' : userId === meId ? 'owe' : 'owes'} ${money(Math.abs(amount))}`;
            return (
              <li className="balances-bar-row" key={userId}>
                <span className="visually-hidden">{label}</span>
                <span className="balances-person" aria-hidden="true">
                  <Avatar name={name(userId)} isYou={userId === meId} />
                  <span className="balances-person-name">{who(userId)}</span>
                </span>
                <span className="balances-track" aria-hidden="true">
                  <span className="balances-track-half balances-track-owe">
                    {!even && !owed && <span className="balances-bar balances-bar-owe" style={{ width: `${pct}%` }} />}
                  </span>
                  <span className="balances-track-half balances-track-owed">
                    {owed && <span className="balances-bar balances-bar-owed" style={{ width: `${pct}%` }} />}
                  </span>
                </span>
                <span
                  className={`balances-bar-amount amount ${even ? '' : owed ? 'owed-to-you' : 'you-owe'}`}
                  aria-hidden="true"
                >
                  {even ? 'even' : `${owed ? '+' : '−'}${money(Math.abs(amount))}`}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
