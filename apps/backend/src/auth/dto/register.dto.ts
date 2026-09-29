import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'email must be a valid email address' })
  email!: string;

  @IsString()
  @MinLength(1, { message: 'name is required' })
  name!: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  password!: string;

  /** "YYYY-MM-DD". Checked against MIN_SIGNUP_AGE in AuthService.register, then saved to the profile. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateOfBirth must be a valid date' })
  dateOfBirth!: string;
}
