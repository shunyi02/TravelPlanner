import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';

@Module({
  imports: [AuthModule],
  providers: [ExpensesService],
  controllers: [ExpensesController],
})
export class ExpensesModule {}