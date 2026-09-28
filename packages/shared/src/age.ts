/** Minimum age to create an account (COPPA threshold). */
export const MIN_SIGNUP_AGE = 13;

/**
 * Whole years between a "YYYY-MM-DD" birth date and `today`, or null if the
 * string isn't a real calendar date. Compares calendar fields only, so the
 * result doesn't depend on time zone or time of day.
 */
export function ageOn(dateOfBirth: string, today: Date = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    return null;
  }

  const [ty, tm, td] = [today.getFullYear(), today.getMonth() + 1, today.getDate()];
  const age = ty - year - (tm < month || (tm === month && td < day) ? 1 : 0);
  return age < 0 ? null : age;
}

export function isOldEnoughToSignUp(dateOfBirth: string, today?: Date): boolean {
  const age = ageOn(dateOfBirth, today);
  return age !== null && age >= MIN_SIGNUP_AGE;
}
