import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SplitsService } from './splits.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('trips/:tripId/splits')
export class SplitsController {
  constructor(private readonly splitsService: SplitsService) {}

  @Get('balances')
  getBalances(@CurrentUser() userId: string, @Param('tripId') tripId: string) {
    return this.splitsService.getBalances(tripId, userId);
  }

  @Get('settlements')
  getSettlements(@CurrentUser() userId: string, @Param('tripId') tripId: string) {
    return this.splitsService.getSettlements(tripId, userId);
  }
}
