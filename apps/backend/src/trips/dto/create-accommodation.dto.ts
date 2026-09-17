import { IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAccommodationDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsISO8601()
  checkInDate!: string;

  @IsISO8601()
  checkOutDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}