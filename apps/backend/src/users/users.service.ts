import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Hashes the plaintext password before storing. */
  async create(data: { email: string; name: string; password: string }) {
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    return this.prisma.user.create({
      data: { email: data.email, name: data.name, passwordHash },
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
  async claimPlaceholder(userId: string, data: { name: string; password: string }) {
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    return this.prisma.user.update({
      where: { id: userId },
      data: { name: data.name, passwordHash, isPlaceholder: false },
    });
  }

  async verifyPassword(plaintext: string, passwordHash: string) {
    return bcrypt.compare(plaintext, passwordHash);
  }

  async updatePassword(userId: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    return this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
}
