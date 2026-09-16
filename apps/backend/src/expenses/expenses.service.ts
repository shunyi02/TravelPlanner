import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

const SHARE_SUM_TOLERANCE = 0.001;

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tripId: string, userId: string, dto: CreateExpenseDto) {
    const members = await this.prisma.tripMember.findMany({ where: { tripId } });
    if (!members.some((m) => m.userId === userId)) {
      throw new ForbiddenException('Not a member of this trip');
    }

    const paidById = dto.paidById ?? userId;
    if (!members.some((m) => m.userId === paidById)) {
      throw new BadRequestException('paidById must be a member of this trip');
    }

    const splitInputs = dto.splits ?? this.evenSplitAcross(members.map((m) => m.userId));
    this.assertSharesValid(splitInputs, members.map((m) => m.userId));

    const amounts = this.sharesToAmounts(dto.amount, splitInputs);

    return this.prisma.expense.create({
      data: {
        tripId,
        description: dto.description,
        amount: dto.amount,
        currency: dto.currency ?? 'USD',
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
    const membership = await this.prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a member of this trip');

    return this.prisma.expense.findMany({
      where: { tripId },
      include: { splits: true },
      orderBy: { createdAt: 'desc' },
    });
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
