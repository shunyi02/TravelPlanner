import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { TripsModule } from './trips/trips.module';
import { ExpensesModule } from './expenses/expenses.module';
import { SplitsModule } from './splits/splits.module';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule, TripsModule, ExpensesModule, SplitsModule],
})
export class AppModule {}
