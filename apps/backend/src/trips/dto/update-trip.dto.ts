import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class UpdateTripDto {
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  /** Changes the currency new expenses are logged in. Existing expenses keep
   *  the currency they were logged with. */
  @IsOptional()
  @IsString()
  currency?: string;
}