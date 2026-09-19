import { computeBalances, simplifyDebts } from './splitting';

describe('computeBalances', () => {
  it('credits the payer and debits each non-payer split', () => {
    const balances = computeBalances([
      {
        paidById: 'alice',
        splits: [
          { userId: 'alice', amountOwed: 0, settled: false },
          { userId: 'bob', amountOwed: 30, settled: false },
          { userId: 'carol', amountOwed: 30, settled: false },
        ],
      },
    ]);

    const byUser = Object.fromEntries(balances.map((b) => [b.userId, b.amount]));
    expect(byUser.alice).toBe(60);
    expect(byUser.bob).toBe(-30);
    expect(byUser.carol).toBe(-30);
  });

  it('nets balances across multiple expenses with different payers', () => {
    const balances = computeBalances([
      {
        paidById: 'alice',
        splits: [
          { userId: 'alice', amountOwed: 0, settled: false },
          { userId: 'bob', amountOwed: 50, settled: false },
        ],
      },
      {
        paidById: 'bob',
        splits: [
          { userId: 'bob', amountOwed: 0, settled: false },
          { userId: 'alice', amountOwed: 20, settled: false },
        ],
      },
    ]);

    const byUser = Object.fromEntries(balances.map((b) => [b.userId, b.amount]));
    // alice: +50 (bob owes her) - 20 (she owes bob) = 30
    expect(byUser.alice).toBe(30);
    expect(byUser.bob).toBe(-30);
  });

  it('excludes splits already marked settled', () => {
    const balances = computeBalances([
      {
        paidById: 'alice',
        splits: [
          { userId: 'alice', amountOwed: 0, settled: false },
          { userId: 'bob', amountOwed: 30, settled: true },
        ],
      },
    ]);

    expect(balances).toEqual([]);
  });

  it('rounds to the cent', () => {
    const balances = computeBalances([
      {
        paidById: 'alice',
        splits: [
          { userId: 'alice', amountOwed: 0, settled: false },
          { userId: 'bob', amountOwed: 33.333333, settled: false },
        ],
      },
    ]);

    const bob = balances.find((b) => b.userId === 'bob');
    expect(bob?.amount).toBe(-33.33);
  });
});

describe('simplifyDebts', () => {
  it('produces no settlements when everyone is even', () => {
    expect(simplifyDebts([{ userId: 'alice', amount: 0 }])).toEqual([]);
  });

  it('matches a single debtor to a single creditor', () => {
    const settlements = simplifyDebts([
      { userId: 'alice', amount: 30 },
      { userId: 'bob', amount: -30 },
    ]);

    expect(settlements).toEqual([{ fromUserId: 'bob', toUserId: 'alice', amount: 30 }]);
  });

  it('nets a three-way split into the minimum payments', () => {
    // alice paid for everyone; bob and carol each owe her a third of 90.
    const settlements = simplifyDebts([
      { userId: 'alice', amount: 60 },
      { userId: 'bob', amount: -30 },
      { userId: 'carol', amount: -30 },
    ]);

    expect(settlements).toHaveLength(2);
    const total = settlements.reduce((sum, s) => sum + s.amount, 0);
    expect(total).toBe(60);
    expect(settlements.every((s) => s.toUserId === 'alice')).toBe(true);
  });

  it('ignores sub-cent noise from floating point math', () => {
    expect(simplifyDebts([{ userId: 'alice', amount: 0.001 }])).toEqual([]);
  });
});
