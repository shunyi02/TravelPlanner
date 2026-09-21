import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  /** A data URL (e.g. from a file input), same pattern as Trip.coverPhoto. */
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
