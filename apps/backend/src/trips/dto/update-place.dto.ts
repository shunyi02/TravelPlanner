import { ArrayUnique, IsArray, IsEnum, IsISO8601, IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PlaceType } from './create-place.dto';

export class UpdatePlaceDto {
  @IsOptional()
  @IsEnum(PlaceType)
  type?: PlaceType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsISO8601()
  visitDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsISO8601()
  departureTime?: string;

  @IsOptional()
  @IsISO8601()
  arrivalTime?: string;

  @IsOptional()
  @IsString()
  departureAirport?: string;

  @IsOptional()
  @IsString()
  arrivalAirport?: string;

  @IsOptional()
  @IsISO8601()
  checkIn?: string;

  @IsOptional()
  @IsISO8601()
  checkOut?: string;

  /** Hotel or stop address. An empty string clears it. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  /** Booking reference for a hotel or flight. An empty string clears it. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  confirmationCode?: string;

  /** e.g. "SQ 850". An empty string clears it. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  flightNumber?: string;

  /** If provided (including []), replaces this item's assignees entirely.
   *  Omitted leaves them unchanged. Empty means "everyone". */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  assigneeIds?: string[];
}
