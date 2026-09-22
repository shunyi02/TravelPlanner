import { ArrayUnique, IsArray, IsEnum, IsISO8601, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
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

  /** If provided (including []), replaces this item's assignees entirely.
   *  Omitted leaves them unchanged. Empty means "everyone". */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  assigneeIds?: string[];
}
