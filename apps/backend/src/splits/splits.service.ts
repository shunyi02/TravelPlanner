import { ForbiddenException, Injectable } from '@nestjs/common';
import { computeBalances, simplifyDebts } from '@travel-planner/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SplitsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Per-user net balances for a trip. Assumes a single currency per trip for now —
   * multi-currency trips would need conversion before these numbers are meaningful.
   */
  async getBalances(tripId: string, userId: string) {
    await this.assertMember(tripId, userId);

    const expenses = await this.prisma.expense.findMany({
      where: { tripId },
      include: { splits: true },
    });

    const currencies = new Set(expenses.map((e) => e.currency));
    if (currencies.size > 1) {
      throw new ForbiddenException(
        `Trip has expenses in multiple currencies (${[...currencies].join(', ')}); ` +
          'balances require a single currency until conversion is implemented',
      );
    }

    return computeBalances(
      expenses.map((e) => ({
        paidById: e.paidById,
        amount: Number(e.amount),
        splits: e.splits.map((s) => ({ userId: s.userId, amountOwed: Number(s.amountOwed) })),
      })),
    );
  }

  async getSettlements(tripId: string, userId: string) {
    const balances = await this.getBalances(tripId, userId);
    return simplifyDebts(balances);
  }

  private async assertMember(tripId: string, userId: string) {
    const membership = await this.prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a member of this trip');
  }
}
