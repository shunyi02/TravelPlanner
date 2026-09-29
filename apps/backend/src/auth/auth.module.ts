import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { UsersModule } from '../users/users.module';
import { MailerModule } from '../mailer/mailer.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    UsersModule,
    MailerModule,
    PassportModule.register({
      defaultStrategy: 'jwt',
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
    // Limits password guessing and email spam on the credential endpoints
    // (see AuthController's @UseGuards(ThrottlerGuard)): 5 tries a minute per
    // IP, counted per endpoint. In-memory, so it resets on restart and is per
    // instance. Behind a proxy, set Express's "trust proxy" so the client IP
    // is used rather than the proxy's.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 5 }],
      errorMessage: 'Too many attempts. Wait a minute and try again.',
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [PassportModule, JwtModule],
})
export class AuthModule {}