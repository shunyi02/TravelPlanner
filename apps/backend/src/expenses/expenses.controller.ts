import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('trips/:tripId/expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  create(
    @CurrentUser() userId: string,
    @Param('tripId') tripId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expensesService.create(tripId, userId, dto);
  }

  @Get()
  list(@CurrentUser() userId: string, @Param('tripId') tripId: string) {
    return this.expensesService.listForTrip(tripId, userId);
  }
}
