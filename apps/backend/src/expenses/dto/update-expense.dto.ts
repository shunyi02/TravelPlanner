import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ExpenseSplitInputDto } from './create-expense.dto';

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  paidById?: string;

  /**
   * If provided, replaces the expense's splits entirely (same validation as
   * create). If omitted but `amount` changes, the existing split ratios are
   * preserved and reapplied to the new amount instead of resetting to even
   * (see ExpensesService.update).
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExpenseSplitInputDto)
  splits?: ExpenseSplitInputDto[];
}
