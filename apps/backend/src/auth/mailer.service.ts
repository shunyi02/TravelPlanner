import { Injectable, Logger } from '@nestjs/common';

/**
 * NOT a real mailer. No SMTP/provider (SendGrid, SES, etc.) is configured.
 * Swap this implementation for one that actually sends email before relying
 * on the forgot-password flow outside local dev.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  async sendPasswordResetEmail(email: string, resetToken: string) {
    this.logger.warn(
      `[MOCK EMAIL] Password reset for ${email} — token: ${resetToken} ` +
        '(would normally be a link like https://yourapp.com/reset-password?token=...)',
    );
  }
}
