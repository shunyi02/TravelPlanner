export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** An ISO datetime string -> the value a `<input type="datetime-local">`
 *  expects ("yyyy-MM-ddTHH:mm"), in the viewer's local time. */
export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A `<input type="datetime-local">` value -> an ISO string suitable for the API. */
export function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}

/** Short, human display for an expense's date/time, e.g. "Sep 30, 3:45 PM". */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Calendar-day key for an ISO datetime, in the viewer's local time (e.g. "2026-09-30"). */
export function dateKey(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Heading for a day group, e.g. "Wed, Sep 30". */
export function formatDayHeading(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** A money amount with its currency code and thousands separators, e.g.
 *  "SGD 1,374.51". Falls back to a plain "SGD 1374.51" for a code Intl
 *  doesn't recognise. */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'code' }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
