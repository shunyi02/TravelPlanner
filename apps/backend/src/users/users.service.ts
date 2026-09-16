import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
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
