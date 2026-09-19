import type { Balance, Settlement } from './types';

const EPSILON = 0.01; // ignore sub-cent noise from floating point math

/**
 * Given equal-currency balances for a trip (positive = owed money, negative = owes money),
 * compute the minimum set of payments that settle all debts.
 *
 * Greedy algorithm: repeatedly match the largest debtor with the largest creditor.
 * This does not guarantee the theoretical minimum number of transactions in all cases
 * (that's NP-hard in general) but produces a good, simple approximation used by most
 * bill-splitting apps (e.g. Splitwise's "simplify debts").
 *
 * Callers are responsible for ensuring all balances are in the same currency —
 * this function does not do currency conversion.
 */
export function simplifyDebts(balances: Balance[]): Settlement[] {
  const debtors = balances
    .filter((b) => b.amount < -EPSILON)
    .map((b) => ({ ...b, amount: -b.amount })) // work with positive "owes" amounts
    .sort((a, b) => b.amount - a.amount);

  const creditors = balances
    .filter((b) => b.amount > EPSILON)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > EPSILON) {
      settlements.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amount: Math.round(amount * 100) / 100,
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount <= EPSILON) i++;
    if (creditor.amount <= EPSILON) j++;
  }

  return settlements;
}

/**
 * Compute per-user net balances for a trip from a flat list of expenses.
 * amountOwed values should already reflect each user's share (see ExpenseSplitInput).
 *
 * A split with `settled: true` means that person already paid the payer back
 * outside the ledger (cash, bank transfer, etc.), so it's excluded entirely —
 * it no longer counts as a debt on either side.
 */
export function computeBalances(
  expenses: Array<{
    paidById: string;
    splits: Array<{ userId: string; amountOwed: number; settled: boolean }>;
  }>,
): Balance[] {
  const net = new Map<string, number>();

  const add = (userId: string, delta: number) => {
    net.set(userId, (net.get(userId) ?? 0) + delta);
  };

  for (const expense of expenses) {
    for (const split of expense.splits) {
      if (split.settled) continue;
      if (split.userId === expense.paidById) continue; // not a debt to anyone
      add(expense.paidById, split.amountOwed);
      add(split.userId, -split.amountOwed);
    }
  }

  return Array.from(net.entries()).map(([userId, amount]) => ({
    userId,
    amount: Math.round(amount * 100) / 100,
  }));
}
