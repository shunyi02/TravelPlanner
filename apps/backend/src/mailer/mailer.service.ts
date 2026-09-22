import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * Sends real email when SMTP_HOST is configured; otherwise falls back to
 * logging the message so local dev (and CI) never needs live SMTP creds.
 * Configure via SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM — see
 * apps/backend/.env.example.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: Number(process.env.SMTP_PORT ?? 587) === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      })
    : null;
  private readonly from = process.env.SMTP_FROM ?? 'Cuti <no-reply@cuti.app>';
  private readonly appUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

  private async send(to: string, subject: string, text: string) {
    if (!this.transporter) {
      this.logger.warn(`[MOCK EMAIL] To: ${to} — ${subject}\n${text}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject, text });
  }

  async sendPasswordResetEmail(email: string, resetToken: string) {
    const link = `${this.appUrl}/?token=${resetToken}`;
    await this.send(
      email,
      'Reset your Cuti password',
      `Someone requested a password reset for this account.\n\n` +
        `Reset your password: ${link}\n\n` +
        `If you didn't request this, you can ignore this email.`,
    );
  }

  async sendInviteEmail(email: string, tripName: string, inviterName: string) {
    await this.send(
      email,
      `${inviterName} invited you to "${tripName}" on Cuti`,
      `${inviterName} added you to the trip "${tripName}" on Cuti.\n\n` +
        `Sign up with this email address to join: ${this.appUrl}/\n\n` +
        `You'll be added to the trip automatically once you register.`,
    );
  }
}
