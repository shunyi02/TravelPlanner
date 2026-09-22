import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
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
  paidById?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsDateString()
  expenseDate?: string;

  /** Null clears the receipt photo. */
  @IsOptional()
  @IsString()
  receiptPhoto?: string | null;

  /** Null clears it back to "no breakdown" (see CreateExpenseDto). */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  subtotal?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  servicePct?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxPct?: number | null;

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
