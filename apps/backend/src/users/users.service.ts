import { Injectable } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { FieldCipherService } from './field-cipher.service';

const SALT_ROUNDS = 10;

/** What the signed-in user sees about themselves. The passport number is
 *  never included in full, only its last four characters; the full value
 *  comes from getPassportNumber, on request. */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  dateOfBirth: string | null; // "YYYY-MM-DD"
  phone: string | null;
  nationality: string | null;
  passportNumberLast4: string | null;
  passportExpiry: string | null; // "YYYY-MM-DD"
  homeCurrency: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  dietaryNotes: string | null;
}

/** A profile edit. Omitted fields stay as they are; null clears one. */
export interface ProfileUpdate {
  name?: string;
  avatarUrl?: string | null;
  dateOfBirth?: string | null;
  phone?: string | null;
  nationality?: string | null;
  passportNumber?: string | null;
  passportExpiry?: string | null;
  homeCurrency?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  dietaryNotes?: string | null;
}

/**
 * The only user columns other trip members may see. Use this whenever a
 * query that reaches the API includes another user: a bare `user: true`
 * would also send the password hash and the private profile fields.
 */
export const MEMBER_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  isPlaceholder: true,
} satisfies Prisma.UserSelect;

/** A "YYYY-MM-DD" calendar date as the UTC midnight Prisma stores in a DATE column, and back. */
const toDbDate = (day: string | null | undefined) =>
  day === undefined ? undefined : day === null ? null : new Date(`${day}T00:00:00Z`);
const fromDbDate = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: FieldCipherService,
  ) {}

  /** Hashes the plaintext password before storing. */
  async create(data: { email: string; name: string; password: string; dateOfBirth: string }) {
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    return this.prisma.user.create({
      data: { email: data.email, name: data.name, passwordHash, dateOfBirth: toDbDate(data.dateOfBirth) },
    });
  }

  /**
   * A member added by name (and optionally a real email) who hasn't
   * registered — usable in expense splits right away. Given no email, gets a
   * synthetic one under the reserved `.invalid` TLD (RFC 2606) so it can
   * never collide with a real signup. The password hash is a random, never
   * shared value: unusable for login until claimed (see claimPlaceholder).
   */
  async createPlaceholder(data: { name: string; email?: string }) {
    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), SALT_ROUNDS);
    return this.prisma.user.create({
      data: {
        email: data.email ?? `${randomUUID()}@member.invalid`,
        name: data.name,
        passwordHash,
        isPlaceholder: true,
      },
    });
  }

  /**
   * Turns a placeholder into a real, logged-in-capable account when someone
   * registers with its email — same id, so their existing trip memberships,
   * expenses and splits carry over untouched.
   */
  async claimPlaceholder(userId: string, data: { name: string; password: string; dateOfBirth: string }) {
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    return this.prisma.user.update({
      where: { id: userId },
      data: { name: data.name, passwordHash, isPlaceholder: false, dateOfBirth: toDbDate(data.dateOfBirth) },
    });
  }

  async verifyPassword(plaintext: string, passwordHash: string) {
    return bcrypt.compare(plaintext, passwordHash);
  }

  async updatePassword(userId: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    return this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async updateProfile(userId: string, data: ProfileUpdate) {
    const { passportNumber, dateOfBirth, passportExpiry, ...rest } = data;
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...rest,
        dateOfBirth: toDbDate(dateOfBirth),
        passportExpiry: toDbDate(passportExpiry),
        passportNumberEncrypted:
          passportNumber === undefined ? undefined : passportNumber === null ? null : this.cipher.encrypt(passportNumber),
      },
    });
  }

  /** The full, decrypted passport number, or null if none is saved. */
  async getPassportNumber(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passportNumberEncrypted: true },
    });
    return user?.passportNumberEncrypted ? this.cipher.decrypt(user.passportNumberEncrypted) : null;
  }

  toProfile(user: User): UserProfile {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      dateOfBirth: fromDbDate(user.dateOfBirth),
      phone: user.phone,
      nationality: user.nationality,
      passportNumberLast4: user.passportNumberEncrypted
        ? this.cipher.decrypt(user.passportNumberEncrypted).slice(-4)
        : null,
      passportExpiry: fromDbDate(user.passportExpiry),
      homeCurrency: user.homeCurrency,
      emergencyContactName: user.emergencyContactName,
      emergencyContactPhone: user.emergencyContactPhone,
      dietaryNotes: user.dietaryNotes,
    };
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
}
