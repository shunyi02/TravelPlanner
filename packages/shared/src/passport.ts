/** Many countries refuse entry unless a passport has this many months left. */
export const PASSPORT_MIN_VALID_MONTHS = 6;

export type PassportExpiryStatus = 'ok' | 'expiring' | 'expired';

/**
 * Whether a "YYYY-MM-DD" passport expiry date is past, inside the
 * PASSPORT_MIN_VALID_MONTHS window, or fine. Null for a malformed date.
 * Compares calendar dates only, like ageOn.
 */
export function passportExpiryStatus(expiry: string, today: Date = new Date()): PassportExpiryStatus | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expiry);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);

  const todayKey = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const expiryKey = year * 10000 + month * 100 + day;
  if (expiryKey < todayKey) return 'expired';

  const cutoff = new Date(today.getFullYear(), today.getMonth() + PASSPORT_MIN_VALID_MONTHS, today.getDate());
  const cutoffKey = cutoff.getFullYear() * 10000 + (cutoff.getMonth() + 1) * 100 + cutoff.getDate();
  return expiryKey < cutoffKey ? 'expiring' : 'ok';
}

/** "•••• 1234" for a stored passport number's last four characters. */
export function maskPassportNumber(last4: string): string {
  return `•••• ${last4}`;
}
