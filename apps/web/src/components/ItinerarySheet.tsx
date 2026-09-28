import type { CSSProperties } from 'react';
import { AirplaneTilt, Bed } from '@phosphor-icons/react';
import type { Place, TripDetail } from '../api';
import { daysBetween, formatTime, groupByDay, hotelDayLabel } from '../itineraryDates';
import { dateKey } from '../format';
import { storedThemeId, THEMES } from '../themes';
import { MiniRoute } from './MiniRoute';

function formatDay(day: string, opts: Intl.DateTimeFormatOptions): string {
  return new Date(day + 'T00:00:00Z').toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' });
}

function formatStamp(iso: string): string {
  return `${formatDay(dateKey(iso), { weekday: 'short', day: 'numeric', month: 'short' })}, ${formatTime(iso)}`;
}

function nights(ci: string, co: string): number {
  return Math.round((Date.parse(dateKey(co) + 'T00:00:00Z') - Date.parse(dateKey(ci) + 'T00:00:00Z')) / 86_400_000);
}

/** The current theme's light-mode colors, so exports are always light and
 *  on-brand even when the app is shown in dark mode. */
function lightTokens(): CSSProperties {
  const theme = THEMES.find((t) => t.id === storedThemeId()) ?? THEMES[0];
  return theme.light as CSSProperties;
}

/** A paper- and share-friendly version of the itinerary: trip header,
 *  bookings, then one section per day with times, notes, who's going and a
 *  route sketch. Used for "Export PDF" (printed) and "Share as image". */
export function ItinerarySheet({
  trip,
  days,
  places,
  memberNames,
  personId,
  scope,
  variant,
}: {
  trip: TripDetail;
  /** The days to include, in order ("YYYY-MM-DD"). */
  days: string[];
  /** The whole trip (with bookings and unscheduled items) or a single day. */
  scope: 'trip' | 'day';
  /** Places already filtered to the chosen person, if any. */
  places: Place[];
  memberNames: Record<string, string>;
  /** Set when exporting one person's plan. */
  personId: string | null;
  variant: 'print' | 'image';
}) {
  const { byDay, unscheduled } = groupByDay(places, days);
  const wholeTrip = scope === 'trip';
  const tripDays = trip.startDate && trip.endDate ? daysBetween(trip.startDate.slice(0, 10), trip.endDate.slice(0, 10)) : [];
  const dayNumber = (day: string) => tripDays.indexOf(day) + 1;

  // Whole trip: every booking. One day: only the flights and stays that day.
  const onDays = (p: Place) => wholeTrip || [...byDay.values()].some((list) => list.includes(p));
  const flights = places
    .filter((p) => p.type === 'FLIGHT' && onDays(p))
    .sort((a, b) => Date.parse(a.departureTime ?? '') - Date.parse(b.departureTime ?? ''));
  const hotels = places
    .filter((p) => p.type === 'HOTEL' && onDays(p))
    .sort((a, b) => Date.parse(a.checkIn ?? '') - Date.parse(b.checkIn ?? ''));

  const people = Object.values(memberNames);
  const dateLine = [
    tripDays.length
      ? `${formatDay(tripDays[0], { weekday: 'short', day: 'numeric', month: 'short' })} – ${formatDay(tripDays[tripDays.length - 1], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}`
      : null,
    tripDays.length ? `${tripDays.length} ${tripDays.length === 1 ? 'day' : 'days'}` : null,
    trip.destinationName,
  ]
    .filter(Boolean)
    .join(' · ');

  const who = (p: Place) =>
    !personId && p.assignments.length > 0
      ? p.assignments.map((a) => (memberNames[a.userId] ?? '').split(' ')[0]).filter(Boolean).join(', ')
      : null;

  const renderItem = (p: Place, day?: string) => {
    let time = '';
    let sub: string | null = null;
    let icon = null;
    if (p.type === 'FLIGHT') {
      icon = <AirplaneTilt size={14} weight="bold" aria-hidden />;
      time = formatTime(p.departureTime);
      const route = `${p.departureAirport ?? '?'} → ${p.arrivalAirport ?? '?'}`;
      sub = p.arrivalTime ? `${route} · lands ${formatTime(p.arrivalTime)}` : route;
    } else if (p.type === 'HOTEL') {
      icon = <Bed size={14} weight="bold" aria-hidden />;
      const label = hotelDayLabel(p, day) ?? '';
      const m = /^(Check-(?:in|out)) (.+)$/.exec(label);
      time = m ? m[2] : '';
      sub = m ? m[1] : label || null;
    } else {
      time = formatTime(p.visitDate);
      sub = p.notes ?? null;
    }
    const going = who(p);
    return (
      <li className={`sheet-item sheet-item-${p.type.toLowerCase()}`} key={`${p.id}-${day ?? ''}`}>
        {variant === 'print' && p.type === 'STOP' ? <span className="sheet-check" aria-hidden="true" /> : <span className="sheet-check-space" />}
        <span className="sheet-time">{time}</span>
        <span className="sheet-what">
          <span className="sheet-name">
            {icon}
            {p.name}
            {going && <span className="sheet-who">{going}</span>}
          </span>
          {sub && <span className="sheet-sub">{sub}</span>}
        </span>
      </li>
    );
  };

  return (
    <article className={`sheet sheet-${variant}`} style={lightTokens()}>
      <header className="sheet-head">
        <div className="sheet-brand" aria-hidden="true">
          <span className="sheet-logo" /> Cuti
        </div>
        <h1 className="sheet-title">{trip.name}</h1>
        {dateLine && <p className="sheet-dates">{dateLine}</p>}
        <p className="sheet-people">{personId ? `Plan for ${memberNames[personId] ?? ''}` : people.join(' · ')}</p>
      </header>

      {(flights.length > 0 || hotels.length > 0) && (
        <section className="sheet-section sheet-bookings">
          <h2 className="sheet-h2">{wholeTrip ? 'Bookings' : 'Bookings today'}</h2>
          <ul className="sheet-booking-list">
            {flights.map((f) => (
              <li key={f.id}>
                <AirplaneTilt size={15} weight="bold" aria-hidden />
                <span className="sheet-booking-name">{f.name}</span>
                <span className="sheet-booking-detail">
                  {f.departureAirport} → {f.arrivalAirport}
                  {f.departureTime && ` · ${formatStamp(f.departureTime)}`}
                  {f.arrivalTime && ` → ${formatTime(f.arrivalTime)}`}
                </span>
              </li>
            ))}
            {hotels.map((h) => (
              <li key={h.id}>
                <Bed size={15} weight="bold" aria-hidden />
                <span className="sheet-booking-name">{h.name}</span>
                <span className="sheet-booking-detail">
                  {h.checkIn && formatDay(dateKey(h.checkIn), { weekday: 'short', day: 'numeric', month: 'short' })}
                  {h.checkOut && ` → ${formatDay(dateKey(h.checkOut), { weekday: 'short', day: 'numeric', month: 'short' })}`}
                  {h.checkIn && h.checkOut && ` · ${nights(h.checkIn, h.checkOut)} nights`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {days.map((day) => {
        const items = byDay.get(day) ?? [];
        const route = items
          .filter((p) => p.lat != null && p.lng != null)
          .map((p) => [p.lat!, p.lng!] as [number, number]);
        const n = dayNumber(day);
        return (
          <section className="sheet-section sheet-day" key={day}>
            <header className="sheet-day-head">
              <h2 className="sheet-h2">{n > 0 ? `Day ${n}` : formatDay(day, { weekday: 'long' })}</h2>
              <span className="sheet-day-date">{formatDay(day, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </header>
            <div className="sheet-day-body">
              {items.length > 0 ? (
                <ol className="sheet-items">{items.map((p) => renderItem(p, day))}</ol>
              ) : (
                <p className="sheet-free">Free day. Nothing planned yet.</p>
              )}
              {route.length > 1 && <MiniRoute route={route} className="sheet-route" width={260} height={170} />}
            </div>
          </section>
        );
      })}

      {wholeTrip && unscheduled.length > 0 && (
        <section className="sheet-section sheet-day">
          <header className="sheet-day-head">
            <h2 className="sheet-h2">Not yet scheduled</h2>
          </header>
          <ol className="sheet-items">{unscheduled.map((p) => renderItem(p))}</ol>
        </section>
      )}

      <footer className="sheet-foot">
        <span>Made with Cuti</span>
        <span>
          {variant === 'print' ? 'Printed' : 'Shared'}{' '}
          {new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </footer>
    </article>
  );
}
