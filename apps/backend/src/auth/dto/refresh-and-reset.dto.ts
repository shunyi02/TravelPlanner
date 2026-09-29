import { IsEmail, IsString, MinLength } from 'class-validator';

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'email must be a valid email address' })
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8, { message: 'newPassword must be at least 8 characters' })
  newPassword!: string;
}
