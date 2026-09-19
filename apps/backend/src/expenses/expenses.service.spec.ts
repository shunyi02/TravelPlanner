import { jest } from '@jest/globals';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ExpensesService } from './expenses.service';

// `@jest/globals`' `jest.fn()` infers a strict mock type from zero arguments
// (usually `Mock<() => never>`), which then rejects any `.mockResolvedValue`/
// `.mockImplementation` call. These mocks stand in for Prisma methods we call
// loosely (via `prisma as any`), so a plain `any` mock is what we actually want.
const mockFn = (): any => jest.fn();

/** Emulates what Prisma actually returns for a nested `splits: { create: [...] }`
 * write: the created rows back as a flat `splits` array, not the write instruction. */
function resolveExpenseWrite({ data }: any) {
  const { splits, ...rest } = data;
  return Promise.resolve({ id: 'expense-1', ...rest, splits: splits?.create ?? [] });
}

const TRIP_ID = 'trip-1';
const USER_A = 'user-a';
const USER_B = 'user-b';
const USER_C = 'user-c';

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    tripMember: {
      findMany: mockFn().mockResolvedValue([{ userId: USER_A }, { userId: USER_B }, { userId: USER_C }]),
      findUnique: mockFn().mockResolvedValue({ tripId: TRIP_ID, userId: USER_A }),
    },
    expense: {
      create: mockFn().mockImplementation(resolveExpenseWrite),
      update: mockFn().mockImplementation(resolveExpenseWrite),
      findUnique: mockFn(),
      deleteMany: mockFn().mockResolvedValue({ count: 1 }),
    },
    expenseSplit: {
      deleteMany: mockFn().mockResolvedValue({ count: 0 }),
      update: mockFn().mockImplementation(({ data }: any) => Promise.resolve({ ...data })),
    },
    $transaction: mockFn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
    ...overrides,
  };
}

describe('ExpensesService.create', () => {
  it('splits evenly across trip members when no splits are given', async () => {
    const prisma = makePrisma();
    const service = new ExpensesService(prisma as any);

    const result = await service.create(TRIP_ID, USER_A, { description: 'Dinner', amount: 100 } as any);

    // 100 / 3 members: 33.33, 33.33, and the last absorbs the rounding remainder (33.34).
    expect(result.splits.map((s: any) => s.amountOwed)).toEqual([33.33, 33.33, 33.34]);
    expect(
      result.splits.reduce((sum: number, s: any) => sum + s.amountOwed, 0),
    ).toBeCloseTo(100, 2);
    expect(result.paidById).toBe(USER_A);
  });

  it('honors custom shares and puts the rounding remainder on the last split', async () => {
    const prisma = makePrisma();
    const service = new ExpensesService(prisma as any);

    const result = await service.create(TRIP_ID, USER_A, {
      description: 'Hotel',
      amount: 100,
      splits: [
        { userId: USER_A, share: 0.25 },
        { userId: USER_B, share: 0.75 },
      ],
    } as any);

    expect(result.splits).toEqual([
      { userId: USER_A, amountOwed: 25 },
      { userId: USER_B, amountOwed: 75 },
    ]);
  });

  it('rejects a paidById who is not a trip member', async () => {
    const prisma = makePrisma();
    const service = new ExpensesService(prisma as any);

    await expect(
      service.create(TRIP_ID, USER_A, { description: 'x', amount: 10, paidById: 'outsider' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a split for a user who is not a trip member', async () => {
    const prisma = makePrisma();
    const service = new ExpensesService(prisma as any);

    await expect(
      service.create(TRIP_ID, USER_A, {
        description: 'x',
        amount: 10,
        splits: [{ userId: 'outsider', share: 1 }],
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects shares that do not sum to 1', async () => {
    const prisma = makePrisma();
    const service = new ExpensesService(prisma as any);

    await expect(
      service.create(TRIP_ID, USER_A, {
        description: 'x',
        amount: 10,
        splits: [
          { userId: USER_A, share: 0.5 },
          { userId: USER_B, share: 0.2 },
        ],
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a requester who is not a trip member', async () => {
    const prisma = makePrisma();
    const service = new ExpensesService(prisma as any);

    await expect(
      service.create(TRIP_ID, 'outsider', { description: 'x', amount: 10 } as any),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('ExpensesService.update', () => {
  function makeExistingExpense() {
    return {
      id: 'expense-1',
      tripId: TRIP_ID,
      amount: '100',
      paidById: USER_A,
      splits: [
        { userId: USER_A, amountOwed: '25', settled: false },
        { userId: USER_B, amountOwed: '75', settled: false },
      ],
    };
  }

  it('preserves existing split ratios when only the amount changes', async () => {
    const prisma = makePrisma({
      expense: {
        findUnique: mockFn().mockResolvedValue(makeExistingExpense()),
        update: mockFn().mockImplementation(resolveExpenseWrite),
      },
    });
    const service = new ExpensesService(prisma as any);

    const result = await service.update(TRIP_ID, USER_A, 'expense-1', { amount: 200 } as any);

    // Original ratio was 25/75; applied to the new total of 200.
    expect(result.splits).toEqual([
      { userId: USER_A, amountOwed: 50 },
      { userId: USER_B, amountOwed: 150 },
    ]);
  });

  it('replaces splits entirely when new splits are given explicitly', async () => {
    const prisma = makePrisma({
      expense: {
        findUnique: mockFn().mockResolvedValue(makeExistingExpense()),
        update: mockFn().mockImplementation(resolveExpenseWrite),
      },
    });
    const service = new ExpensesService(prisma as any);

    const result = await service.update(TRIP_ID, USER_A, 'expense-1', {
      splits: [{ userId: USER_A, share: 1 }],
    } as any);

    expect(prisma.expenseSplit.deleteMany).toHaveBeenCalledWith({ where: { expenseId: 'expense-1' } });
    expect(result.splits).toEqual([{ userId: USER_A, amountOwed: 100 }]);
  });

  it('leaves splits untouched when neither amount nor splits change', async () => {
    const prisma = makePrisma({
      expense: {
        findUnique: mockFn().mockResolvedValue(makeExistingExpense()),
        update: mockFn().mockResolvedValue({ id: 'expense-1', description: 'renamed' }),
      },
    });
    const service = new ExpensesService(prisma as any);

    await service.update(TRIP_ID, USER_A, 'expense-1', { description: 'renamed' } as any);

    expect(prisma.expenseSplit.deleteMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws when the expense belongs to a different trip', async () => {
    const prisma = makePrisma({
      expense: {
        findUnique: mockFn().mockResolvedValue({ ...makeExistingExpense(), tripId: 'other-trip' }),
        update: mockFn(),
      },
    });
    const service = new ExpensesService(prisma as any);

    await expect(service.update(TRIP_ID, USER_A, 'expense-1', {} as any)).rejects.toThrow(NotFoundException);
  });
});

describe('ExpensesService.setSplitSettled', () => {
  function makeExpense() {
    return {
      id: 'expense-1',
      tripId: TRIP_ID,
      paidById: USER_A,
      splits: [{ userId: USER_B, amountOwed: '50', settled: false }],
    };
  }

  it('updates the settled flag for a valid split', async () => {
    const prisma = makePrisma({
      tripMember: { findUnique: mockFn().mockResolvedValue({ userId: USER_A }) },
      expense: { findUnique: mockFn().mockResolvedValue(makeExpense()) },
    });
    const service = new ExpensesService(prisma as any);

    await service.setSplitSettled(TRIP_ID, USER_A, 'expense-1', USER_B, true);

    expect(prisma.expenseSplit.update).toHaveBeenCalledWith({
      where: { expenseId_userId: { expenseId: 'expense-1', userId: USER_B } },
      data: { settled: true },
    });
  });

  it("refuses to settle the payer's own share", async () => {
    const prisma = makePrisma({
      tripMember: { findUnique: mockFn().mockResolvedValue({ userId: USER_A }) },
      expense: { findUnique: mockFn().mockResolvedValue(makeExpense()) },
    });
    const service = new ExpensesService(prisma as any);

    await expect(
      service.setSplitSettled(TRIP_ID, USER_A, 'expense-1', USER_A, true),
    ).rejects.toThrow(BadRequestException);
  });

  it('404s for a split that does not exist on the expense', async () => {
    const prisma = makePrisma({
      tripMember: { findUnique: mockFn().mockResolvedValue({ userId: USER_A }) },
      expense: { findUnique: mockFn().mockResolvedValue(makeExpense()) },
    });
    const service = new ExpensesService(prisma as any);

    await expect(
      service.setSplitSettled(TRIP_ID, USER_A, 'expense-1', 'nobody', true),
    ).rejects.toThrow(NotFoundException);
  });
});
