/** "04 OCT" from an ISO date (the date part only, read as UTC). */
export function formatShort(iso: string): string {
  return new Date(iso.slice(0, 10) + 'T00:00:00Z')
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })
    .toUpperCase();
}

/** Inclusive day count between two ISO dates. */
export function dayCount(start: string, end: string): number {
  const ms = new Date(end.slice(0, 10) + 'T00:00:00Z').getTime() - new Date(start.slice(0, 10) + 'T00:00:00Z').getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/** "In 12 days" / "On the road" / "Wrapped up", or null without dates. */
export function tripStatus(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local
  if (today < start.slice(0, 10)) {
    const n = dayCount(today, start) - 1;
    return n === 1 ? 'Tomorrow' : `In ${n} days`;
  }
  if (today <= end.slice(0, 10)) return 'On the road';
  return 'Wrapped up';
}
