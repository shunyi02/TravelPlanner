import { IsISO8601, IsInt, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePlaceDto {
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
}
