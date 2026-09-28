import { IsBoolean, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CreateChecklistItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;

  /** One of CHECKLIST_CATEGORIES. Defaults to "Other". */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;

  /** The member bringing it for the group. Omitted means everyone packs their own. */
  @IsOptional()
  @IsString()
  assigneeId?: string;
}

export class UpdateChecklistItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;

  /** null clears the assignee; omitted leaves it unchanged. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  assigneeId?: string | null;

  @IsOptional()
  @IsBoolean()
  packed?: boolean;
}
