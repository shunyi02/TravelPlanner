import { jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { SplitsService } from './splits.service';

// See expenses.service.spec.ts for why this needs an `any`-typed mock factory.
const mockFn = (): any => jest.fn();

const TRIP_ID = 'trip-1';
const USER_A = 'user-a';
const USER_B = 'user-b';
const USER_C = 'user-c';

function makeExpense(paidById: string, splits: Array<{ userId: string; amountOwed: string; settled: boolean }>) {
  return { paidById, currency: 'USD', splits };
}

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    tripMember: {
      findUnique: mockFn().mockResolvedValue({ tripId: TRIP_ID, userId: USER_A }),
    },
    expense: {
      findMany: mockFn().mockResolvedValue([]),
    },
    ...overrides,
  };
}

describe('SplitsService.getBalances', () => {
  it('rejects a requester who is not a trip member', async () => {
    const prisma = makePrisma({ tripMember: { findUnique: mockFn().mockResolvedValue(null) } });
    const service = new SplitsService(prisma as any);

    await expect(service.getBalances(TRIP_ID, 'outsider')).rejects.toThrow(ForbiddenException);
  });

  it('credits the payer and debits each non-payer split, converting Decimal strings to numbers', async () => {
    const prisma = makePrisma({
      expense: {
        findMany: mockFn().mockResolvedValue([
          makeExpense(USER_A, [
            { userId: USER_A, amountOwed: '0', settled: false },
            { userId: USER_B, amountOwed: '30', settled: false },
            { userId: USER_C, amountOwed: '30', settled: false },
          ]),
        ]),
      },
    });
    const service = new SplitsService(prisma as any);

    const balances = await service.getBalances(TRIP_ID, USER_A);

    const byUser = Object.fromEntries(balances.map((b) => [b.userId, b.amount]));
    expect(byUser[USER_A]).toBe(60);
    expect(byUser[USER_B]).toBe(-30);
    expect(byUser[USER_C]).toBe(-30);
  });

  it('nets balances across multiple expenses with different payers', async () => {
    const prisma = makePrisma({
      expense: {
        findMany: mockFn().mockResolvedValue([
          makeExpense(USER_A, [
            { userId: USER_A, amountOwed: '0', settled: false },
            { userId: USER_B, amountOwed: '50', settled: false },
          ]),
          makeExpense(USER_B, [
            { userId: USER_B, amountOwed: '0', settled: false },
            { userId: USER_A, amountOwed: '20', settled: false },
          ]),
        ]),
      },
    });
    const service = new SplitsService(prisma as any);

    const balances = await service.getBalances(TRIP_ID, USER_A);

    const byUser = Object.fromEntries(balances.map((b) => [b.userId, b.amount]));
    expect(byUser[USER_A]).toBe(30);
    expect(byUser[USER_B]).toBe(-30);
  });

  it('excludes splits already marked settled', async () => {
    const prisma = makePrisma({
      expense: {
        findMany: mockFn().mockResolvedValue([
          makeExpense(USER_A, [
            { userId: USER_A, amountOwed: '0', settled: false },
            { userId: USER_B, amountOwed: '30', settled: true },
          ]),
        ]),
      },
    });
    const service = new SplitsService(prisma as any);

    expect(await service.getBalances(TRIP_ID, USER_A)).toEqual([]);
  });

  it('rejects a trip with expenses in more than one currency', async () => {
    const prisma = makePrisma({
      expense: {
        findMany: mockFn().mockResolvedValue([
          { ...makeExpense(USER_A, [{ userId: USER_B, amountOwed: '30', settled: false }]), currency: 'USD' },
          { ...makeExpense(USER_A, [{ userId: USER_B, amountOwed: '10', settled: false }]), currency: 'MYR' },
        ]),
      },
    });
    const service = new SplitsService(prisma as any);

    await expect(service.getBalances(TRIP_ID, USER_A)).rejects.toThrow(ForbiddenException);
  });

  it('allows a trip whose expenses all share one currency', async () => {
    const prisma = makePrisma({
      expense: {
        findMany: mockFn().mockResolvedValue([
          makeExpense(USER_A, [{ userId: USER_B, amountOwed: '30', settled: false }]),
          makeExpense(USER_A, [{ userId: USER_B, amountOwed: '10', settled: false }]),
        ]),
      },
    });
    const service = new SplitsService(prisma as any);

    await expect(service.getBalances(TRIP_ID, USER_A)).resolves.not.toThrow();
  });
});

describe('SplitsService.getSettlements', () => {
  it('rejects a requester who is not a trip member', async () => {
    const prisma = makePrisma({ tripMember: { findUnique: mockFn().mockResolvedValue(null) } });
    const service = new SplitsService(prisma as any);

    await expect(service.getSettlements(TRIP_ID, 'outsider')).rejects.toThrow(ForbiddenException);
  });

  it('simplifies net balances into the minimum set of payments', async () => {
    const prisma = makePrisma({
      expense: {
        findMany: mockFn().mockResolvedValue([
          makeExpense(USER_A, [
            { userId: USER_A, amountOwed: '0', settled: false },
            { userId: USER_B, amountOwed: '30', settled: false },
            { userId: USER_C, amountOwed: '30', settled: false },
          ]),
        ]),
      },
    });
    const service = new SplitsService(prisma as any);

    const settlements = await service.getSettlements(TRIP_ID, USER_A);

    expect(settlements).toHaveLength(2);
    expect(settlements.every((s) => s.toUserId === USER_A)).toBe(true);
    expect(settlements.reduce((sum, s) => sum + s.amount, 0)).toBe(60);
  });

  it('produces no settlements when everyone is already even', async () => {
    const prisma = makePrisma({ expense: { findMany: mockFn().mockResolvedValue([]) } });
    const service = new SplitsService(prisma as any);

    expect(await service.getSettlements(TRIP_ID, USER_A)).toEqual([]);
  });
});
