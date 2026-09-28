/**
 * Day-level date helpers shared by the itinerary, the trip-dates editor and
 * the itinerary export, on web and mobile. Days are "YYYY-MM-DD" calendar
 * keys: trip dates are stored as plain dates, and an item's day is the local
 * calendar day of its time, the same time the app displays and the item was
 * entered in. (Using the UTC date put anything scheduled after midnight local
 * time, east of UTC, on the previous day.)
 */

/** The fields of an itinerary item these helpers read. */
export interface DatedPlace {
  type: 'STOP' | 'HOTEL' | 'FLIGHT';
  visitDate: string | null;
  departureTime: string | null;
  checkIn: string | null;
  checkOut: string | null;
}

/** The local calendar day ("YYYY-MM-DD") of an ISO timestamp. */
export function dateKey(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

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

/** Calendar-day difference between two "YYYY-MM-DD" keys. */
export function dayDelta(fromDay: string, toDay: string): number {
  const from = new Date(fromDay + 'T00:00:00Z').getTime();
  const to = new Date(toDay + 'T00:00:00Z').getTime();
  return Math.round((to - from) / 86_400_000);
}

/** Which day-buckets a place belongs in. Hotels span every day from checkIn to checkOut
 *  inclusive; flights/stops occupy a single day. */
export function dayKeysFor(place: DatedPlace): string[] {
  if (place.type === 'HOTEL') {
    if (!place.checkIn) return [];
    const ci = dateKey(place.checkIn);
    const co = place.checkOut ? dateKey(place.checkOut) : ci;
    return daysBetween(ci, co);
  }
  if (place.type === 'FLIGHT') {
    return place.departureTime ? [dateKey(place.departureTime)] : [];
  }
  return place.visitDate ? [dateKey(place.visitDate)] : [];
}

/** A "YYYY-MM-DD" key moved by whole days. */
export function shiftDay(day: string, delta: number): string {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function formatTime(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** For a hotel shown under a specific day, label what's happening that day
 *  (check-in / staying / check-out), including time if set. Undefined `day`
 *  means "not day-bucketed" (flat/unscheduled view) — falls back to date range. */
export function hotelDayLabel(place: DatedPlace, day?: string): string | null {
  const ci = place.checkIn ? dateKey(place.checkIn) : undefined;
  const co = place.checkOut ? dateKey(place.checkOut) : undefined;
  if (!day || !ci) {
    return ci || co ? `${ci ?? ''}${co ? ` – ${co}` : ''}` : null;
  }
  if (day === ci && day === co) {
    return `Check-in ${formatTime(place.checkIn)} & check-out ${formatTime(place.checkOut)}`;
  }
  if (day === ci) return `Check-in ${formatTime(place.checkIn)}`;
  if (day === co) return `Check-out ${formatTime(place.checkOut)}`;
  return 'Staying';
}

/** Sort key for ordering rows within a single day bucket. Hotels use checkout
 *  time on their checkout day, check-in time otherwise (so "11am checkout" sits
 *  above "3pm check-in" on a same-day changeover). */
export function sortTimeForDay(place: DatedPlace, day?: string): number {
  if (place.type === 'HOTEL') {
    const ci = place.checkIn;
    const co = place.checkOut;
    if (day && co && day === dateKey(co) && (!ci || day !== dateKey(ci))) {
      return new Date(co).getTime();
    }
    return ci ? new Date(ci).getTime() : 0;
  }
  if (place.type === 'FLIGHT') return place.departureTime ? new Date(place.departureTime).getTime() : 0;
  return place.visitDate ? new Date(place.visitDate).getTime() : 0;
}

/** Places bucketed into the given days, each day sorted by time; places with
 *  no day inside `days` go to `unscheduled`. Hotels appear on every day of
 *  their stay. */
export function groupByDay<P extends DatedPlace>(
  places: P[],
  days: string[],
): { byDay: Map<string, P[]>; unscheduled: P[] } {
  const daySet = new Set(days);
  const byDay = new Map<string, P[]>();
  const unscheduled: P[] = [];
  for (const p of places) {
    const keys = dayKeysFor(p).filter((k) => daySet.has(k));
    if (keys.length === 0) unscheduled.push(p);
    for (const key of keys) {
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(p);
    }
  }
  for (const [day, dayPlaces] of byDay) {
    dayPlaces.sort((a, b) => sortTimeForDay(a, day) - sortTimeForDay(b, day));
  }
  return { byDay, unscheduled };
}
