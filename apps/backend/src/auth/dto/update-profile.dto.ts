import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { COUNTRIES } from '@travel-planner/shared';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const PHONE = /^\+?[\d\s()-]{6,20}$/;
const PHONE_MESSAGE = 'must be a phone number: digits, spaces, ( ) - and an optional leading +';

/**
 * A partial profile edit. Omitted fields stay as they are; null clears one
 * (IsOptional lets null through, and UsersService.updateProfile writes it).
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  /** A data URL (e.g. from a file input), same pattern as Trip.coverPhoto. */
  @IsOptional()
  @IsString()
  avatarUrl?: string | null;

  /** "YYYY-MM-DD". AuthService.updateProfile also applies the signup age floor. */
  @IsOptional()
  @Matches(DAY, { message: 'dateOfBirth must be YYYY-MM-DD' })
  dateOfBirth?: string | null;

  @IsOptional()
  @Matches(PHONE, { message: `phone ${PHONE_MESSAGE}` })
  phone?: string | null;

  @IsOptional()
  @IsIn(COUNTRIES.map((c) => c.code), { message: 'nationality must be an ISO 3166-1 alpha-2 country code' })
  nationality?: string | null;

  /** Normalised to upper case without spaces, then encrypted before storage. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s+/g, '').toUpperCase() : value))
  @Matches(/^[A-Z0-9]{5,20}$/, { message: 'passportNumber must be 5 to 20 letters or digits' })
  passportNumber?: string | null;

  @IsOptional()
  @Matches(DAY, { message: 'passportExpiry must be YYYY-MM-DD' })
  passportExpiry?: string | null;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/, { message: 'homeCurrency must be a 3-letter currency code' })
  homeCurrency?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  emergencyContactName?: string | null;

  @IsOptional()
  @Matches(PHONE, { message: `emergencyContactPhone ${PHONE_MESSAGE}` })
  emergencyContactPhone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  dietaryNotes?: string | null;
}
