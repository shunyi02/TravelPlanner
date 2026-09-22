import { ArrayUnique, IsArray, IsEnum, IsISO8601, IsInt, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export enum PlaceType {
  STOP = 'STOP',
  HOTEL = 'HOTEL',
  FLIGHT = 'FLIGHT',
}

export class CreatePlaceDto {
  @IsEnum(PlaceType)
  type!: PlaceType;

  @IsString()
  @MinLength(1)
  name!: string;

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
  @IsInt()
  order?: number;

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

  /** Trip member IDs this item is for. Omitted or empty means everyone —
   *  for splitting a large group's itinerary across sub-groups. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  assigneeIds?: string[];
}