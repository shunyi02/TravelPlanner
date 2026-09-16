import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

class ExpenseSplitInputDto {
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

  @IsOptional()
  @IsString()
  currency?: string;

  /** Who actually paid. Defaults to the requesting user if omitted. */
  @IsOptional()
  @IsString()
  paidById?: string;

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
