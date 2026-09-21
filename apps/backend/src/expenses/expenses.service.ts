import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

const SHARE_SUM_TOLERANCE = 0.001;

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tripId: string, userId: string, dto: CreateExpenseDto) {
    const members = await this.assertMemberAndGetTripMembers(tripId, userId);

    const paidById = dto.paidById ?? userId;
    if (!members.some((m) => m.userId === paidById)) {
      throw new BadRequestException('paidById must be a member of this trip');
    }

    const splitInputs = dto.splits ?? this.evenSplitAcross(members.map((m) => m.userId));
    this.assertSharesValid(splitInputs, members.map((m) => m.userId));

    const amounts = this.sharesToAmounts(dto.amount, splitInputs);
    // Every expense is logged in its trip's currency — there's no per-expense
    // override, so Balances never has to reconcile mixed currencies.
    const { currency } = await this.prisma.trip.findUniqueOrThrow({ where: { id: tripId }, select: { currency: true } });

    return this.prisma.expense.create({
      data: {
        tripId,
        description: dto.description,
        amount: dto.amount,
        currency,
        category: dto.category ?? 'Other',
        expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : new Date(),
        subtotal: dto.subtotal,
        servicePct: dto.servicePct,
        taxPct: dto.taxPct,
        paidById,
        splits: {
          create: amounts.map(({ userId: splitUserId, amount }) => ({
            userId: splitUserId,
            amountOwed: amount,
          })),
        },
      },
      include: { splits: true },
    });
  }

  async listForTrip(tripId: string, userId: string) {
    await this.assertMember(tripId, userId);

    return this.prisma.expense.findMany({
      where: { tripId },
      include: { splits: true },
      orderBy: { expenseDate: 'desc' },
    });
  }

  async update(tripId: string, userId: string, expenseId: string, dto: UpdateExpenseDto) {
    const members = await this.assertMemberAndGetTripMembers(tripId, userId);
    const expense = await this.findOneOrThrow(tripId, expenseId);

    if (dto.paidById && !members.some((m) => m.userId === dto.paidById)) {
      throw new BadRequestException('paidById must be a member of this trip');
    }

    const newAmount = dto.amount ?? Number(expense.amount);

    let splitInputs: Array<{ userId: string; share: number }> | null = null;
    if (dto.splits) {
      splitInputs = dto.splits;
      this.assertSharesValid(splitInputs, members.map((m) => m.userId));
    } else if (dto.amount !== undefined) {
      // Amount changed but no explicit splits given: preserve the existing
      // split ratios instead of silently resetting to an even split.
      const oldAmount = Number(expense.amount);
      splitInputs = expense.splits.map((s) => ({
        userId: s.userId,
        share: oldAmount > 0 ? Number(s.amountOwed) / oldAmount : 0,
      }));
    }

    const scalarData = {
      description: dto.description,
      amount: dto.amount,
      paidById: dto.paidById,
      category: dto.category,
      expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
      subtotal: dto.subtotal,
      servicePct: dto.servicePct,
      taxPct: dto.taxPct,
    };

    if (splitInputs) {
      const amounts = this.sharesToAmounts(newAmount, splitInputs);
      const [, updated] = await this.prisma.$transaction([
        this.prisma.expenseSplit.deleteMany({ where: { expenseId } }),
        this.prisma.expense.update({
          where: { id: expenseId },
          data: {
            ...scalarData,
            splits: {
              create: amounts.map(({ userId: splitUserId, amount }) => ({
                userId: splitUserId,
                amountOwed: amount,
              })),
            },
          },
          include: { splits: true },
        }),
      ]);
      return updated;
    }

    return this.prisma.expense.update({
      where: { id: expenseId },
      data: scalarData,
      include: { splits: true },
    });
  }

  async remove(tripId: string, userId: string, expenseId: string) {
    await this.assertMember(tripId, userId);
    await this.prisma.expense.deleteMany({ where: { id: expenseId, tripId } });
  }

  async setSplitSettled(
    tripId: string,
    userId: string,
    expenseId: string,
    splitUserId: string,
    settled: boolean,
  ) {
    await this.assertMember(tripId, userId);
    const expense = await this.findOneOrThrow(tripId, expenseId);

    if (splitUserId === expense.paidById) {
      throw new BadRequestException("Can't settle the payer's own share");
    }
    if (!expense.splits.some((s) => s.userId === splitUserId)) {
      throw new NotFoundException('Split not found for this expense');
    }

    return this.prisma.expenseSplit.update({
      where: { expenseId_userId: { expenseId, userId: splitUserId } },
      data: { settled },
    });
  }

  private async findOneOrThrow(tripId: string, expenseId: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      include: { splits: true },
    });
    if (!expense || expense.tripId !== tripId) {
      throw new NotFoundException('Expense not found');
    }
    return expense;
  }

  private async assertMember(tripId: string, userId: string) {
    const membership = await this.prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a member of this trip');
  }

  private async assertMemberAndGetTripMembers(tripId: string, userId: string) {
    const members = await this.prisma.tripMember.findMany({ where: { tripId } });
    if (!members.some((m) => m.userId === userId)) {
      throw new ForbiddenException('Not a member of this trip');
    }
    return members;
  }

  private evenSplitAcross(userIds: string[]) {
    const share = 1 / userIds.length;
    return userIds.map((id) => ({ userId: id, share }));
  }

  private assertSharesValid(
    splits: Array<{ userId: string; share: number }>,
    validUserIds: string[],
  ) {
    const validSet = new Set(validUserIds);
    for (const s of splits) {
      if (!validSet.has(s.userId)) {
        throw new BadRequestException(`Split user ${s.userId} is not a member of this trip`);
      }
    }
    const total = splits.reduce((sum, s) => sum + s.share, 0);
    if (Math.abs(total - 1) > SHARE_SUM_TOLERANCE) {
      throw new BadRequestException(`Split shares must sum to 1, got ${total}`);
    }
  }

  /**
   * Converts fractional shares into cent-accurate amounts that sum exactly to
   * the total (any rounding remainder is absorbed by the last split).
   */
  private sharesToAmounts(totalAmount: number, splits: Array<{ userId: string; share: number }>) {
    const totalCents = Math.round(totalAmount * 100);
    let remainingCents = totalCents;
    const result: Array<{ userId: string; amount: number }> = [];

    splits.forEach((split, index) => {
      const isLast = index === splits.length - 1;
      const cents = isLast ? remainingCents : Math.round(totalCents * split.share);
      remainingCents -= cents;
      result.push({ userId: split.userId, amount: cents / 100 });
    });

    return result;
  }
}
