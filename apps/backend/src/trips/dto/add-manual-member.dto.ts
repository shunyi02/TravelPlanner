import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class AddManualMemberDto {
  @IsString()
  @MinLength(1)
  name!: string;

  /** If given and it belongs to a real (non-placeholder) account, that
   *  account is added directly. Otherwise a placeholder member is created
   *  (or reused, if a placeholder with this email already exists). */
  @IsOptional()
  @IsEmail()
  email?: string;
}
