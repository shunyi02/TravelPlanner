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

export class ExpenseSplitInputDto {
  @IsString()
  userId!: string;

  /** Fraction of the total this user owes, e.g. 0.5. All shares in the request must sum to 1. */
  @IsNumber()
  @Min(0)
  share!: number;
}

export class CreateExpenseDto {
  @IsString()
  @MinLength(1)
  description!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  /** Who actually paid. Defaults to the requesting user if omitted. */
  @IsOptional()
  @IsString()
  paidById?: string;

  /** From EXPENSE_CATEGORIES in the shared package. Defaults to "Other". */
  @IsOptional()
  @IsString()
  category?: string;

  /** Pre-tax amount, when `amount` was computed from a subtotal plus
   *  servicePct/taxPct rather than entered directly. */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  subtotal?: number;

  /** Service charge, as a percentage (e.g. 10 for 10%). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  servicePct?: number;

  /** Tax, as a percentage, applied on top of subtotal+servicePct. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxPct?: number;

  /** ISO datetime string for when the expense happened. Defaults to now. */
  @IsOptional()
  @IsDateString()
  expenseDate?: string;

  /** A photo of the receipt, as a data URL (same pattern as Trip.coverPhoto). */
  @IsOptional()
  @IsString()
  receiptPhoto?: string;

  /**
   * Who owes what share of this expense. If omitted, splits evenly across
   * all current trip members.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExpenseSplitInputDto)
  splits?: ExpenseSplitInputDto[];
}
