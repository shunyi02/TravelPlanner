import { IsISO8601, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

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

  /** Move every dated itinerary item (stop visit dates, hotel check-in/out,
   *  flight times) by this many whole days, in the same transaction as the
   *  date change: for a trip that's been postponed or brought forward. */
  @IsOptional()
  @IsInt()
  @Min(-3650)
  @Max(3650)
  shiftItineraryDays?: number;
}
