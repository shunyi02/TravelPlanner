import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { UpdateSplitDto } from './dto/update-split.dto';
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

  @Patch(':expenseId')
  update(
    @CurrentUser() userId: string,
    @Param('tripId') tripId: string,
    @Param('expenseId') expenseId: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(tripId, userId, expenseId, dto);
  }

  @Delete(':expenseId')
  @HttpCode(204)
  remove(
    @CurrentUser() userId: string,
    @Param('tripId') tripId: string,
    @Param('expenseId') expenseId: string,
  ) {
    return this.expensesService.remove(tripId, userId, expenseId);
  }

  @Patch(':expenseId/splits/:splitUserId')
  setSplitSettled(
    @CurrentUser() userId: string,
    @Param('tripId') tripId: string,
    @Param('expenseId') expenseId: string,
    @Param('splitUserId') splitUserId: string,
    @Body() dto: UpdateSplitDto,
  ) {
    return this.expensesService.setSplitSettled(tripId, userId, expenseId, splitUserId, dto.settled);
  }
}
