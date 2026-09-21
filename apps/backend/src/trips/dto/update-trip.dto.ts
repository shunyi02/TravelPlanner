import { IsISO8601, IsNumber, IsOptional, IsString } from 'class-validator';

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

  /** Null clears the budget back to "not set". */
  @IsOptional()
  @IsNumber()
  budget?: number | null;

  @IsOptional()
  @IsString()
  destinationName?: string;

  @IsOptional()
  @IsNumber()
  destinationLat?: number;

  @IsOptional()
  @IsNumber()
  destinationLng?: number;
}