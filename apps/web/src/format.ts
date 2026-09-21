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
