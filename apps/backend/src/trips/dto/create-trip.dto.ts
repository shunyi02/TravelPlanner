import { IsISO8601, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTripDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsString()
  coverPhoto?: string;

  /** ISO 4217 code, e.g. "USD". Defaults to USD. Every expense on this trip
   *  is logged in this currency. */
  @IsOptional()
  @IsString()
  currency?: string;

  /** The trip's city/area — geocoded client-side (Nominatim), sent as a
   *  name + coordinates. Powers the "suggest places to visit" panel. */
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
