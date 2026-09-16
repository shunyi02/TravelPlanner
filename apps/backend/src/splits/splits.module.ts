import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SplitsService } from './splits.service';
import { SplitsController } from './splits.controller';

@Module({
  imports: [AuthModule],
  providers: [SplitsService],
  controllers: [SplitsController],
})
export class SplitsModule {}