import type { Place } from './api';

/** Day-level date helpers shared by the itinerary and the trip-dates editor.
 *  Days are "YYYY-MM-DD" keys anchored to UTC midnight, matching how trip
 *  dates are stored and how itinerary items are bucketed into days. */

export function daysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const cur = new Date(start + 'T00:00:00Z');
  const last = new Date(end + 'T00:00:00Z');
  while (cur <= last) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

/** Calendar-day difference between two "YYYY-MM-DD" keys (UTC-anchored, matching
 *  dayKeysFor's convention). */
export function dayDelta(fromDay: string, toDay: string): number {
  const from = new Date(fromDay + 'T00:00:00Z').getTime();
  const to = new Date(toDay + 'T00:00:00Z').getTime();
  return Math.round((to - from) / 86_400_000);
}

/** Which day-buckets a place belongs in. Hotels span every day from checkIn to checkOut
 *  inclusive; flights/stops occupy a single day. */
export function dayKeysFor(place: Place): string[] {
  if (place.type === 'HOTEL') {
    if (!place.checkIn) return [];
    const ci = place.checkIn.slice(0, 10);
    const co = place.checkOut ? place.checkOut.slice(0, 10) : ci;
    const keys: string[] = [];
    const cur = new Date(ci + 'T00:00:00Z');
    const last = new Date(co + 'T00:00:00Z');
    while (cur <= last) {
      keys.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return keys;
  }
  if (place.type === 'FLIGHT') {
    return place.departureTime ? [place.departureTime.slice(0, 10)] : [];
  }
  return place.visitDate ? [place.visitDate.slice(0, 10)] : [];
}

/** A "YYYY-MM-DD" key moved by whole days. */
export function shiftDay(day: string, delta: number): string {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
