/**
 * DateField reads and writes plain local strings, the same ones the forms already
 * parse: "YYYY-MM-DD" for a date, "YYYY-MM-DD HH:mm" for a date and time, "" for none.
 */
export type DateFieldMode = 'date' | 'datetime';

const pad = (n: number) => String(n).padStart(2, '0');

export function toDate(value: string, mode: DateFieldMode): Date | null {
  if (!value) return null;
  const d = new Date(mode === 'date' ? `${value}T00:00:00` : value.replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}

export function fromDate(d: Date, mode: DateFieldMode): string {
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return mode === 'date' ? day : `${day} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Sat, 12 Dec 2026" or "Sat, 12 Dec 2026, 3:00 pm". */
export function formatValue(value: string, mode: DateFieldMode): string {
  const d = toDate(value, mode);
  if (!d) return '';
  const date = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  return mode === 'date' ? date : `${date}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}
