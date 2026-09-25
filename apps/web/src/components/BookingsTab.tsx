import { AirplaneTilt, Bed } from '@phosphor-icons/react';
import type { Place } from '../api';

function formatTime(iso: string | null): string {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** "9/25 Fri" — month/day plus short weekday, in the viewer's local time. */
function formatDate(iso: string | null): string {
  if (!iso) return 'Date TBC';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleDateString(undefined, { weekday: 'short' })}`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDuration(from: string | null, to: string | null): string | null {
  if (!from || !to) return null;
  const mins = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000);
  if (mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
}

function nightCount(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn.slice(0, 10) + 'T00:00:00Z').getTime();
  const b = new Date(checkOut.slice(0, 10) + 'T00:00:00Z').getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Where a booking sits relative to now — same wording as the trip hero. */
function bookingStatus(start: string | null, end: string | null): { label: string; past: boolean } | null {
  if (!start) return null;
  const now = Date.now();
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : startMs;
  if (now > endMs) return { label: 'Done', past: true };
  if (now >= startMs) return { label: 'In progress', past: false };
  const today = new Date().toLocaleDateString('en-CA');
  const startDay = new Date(start).toLocaleDateString('en-CA');
  const days = Math.round(
    (new Date(startDay + 'T00:00:00Z').getTime() - new Date(today + 'T00:00:00Z').getTime()) / 86_400_000,
  );
  if (days <= 0) return { label: 'Today', past: false };
  return { label: days === 1 ? 'Tomorrow' : `In ${days} days`, past: false };
}

function sortKey(p: Place): number {
  const iso = p.type === 'FLIGHT' ? p.departureTime : p.checkIn;
  return iso ? new Date(iso).getTime() : Number.MAX_SAFE_INTEGER;
}

function StatusBadge({ start, end }: { start: string | null; end: string | null }) {
  const status = bookingStatus(start, end);
  if (!status) return null;
  return <span className={`booking-badge${status.past ? ' is-past' : ''}`}>{status.label}</span>;
}

function Footer({ place, memberNames, extra }: { place: Place; memberNames: Record<string, string>; extra?: string }) {
  const who =
    place.assignments.length > 0 ? `For ${place.assignments.map((a) => memberNames[a.userId] ?? a.userId).join(', ')}` : null;
  const parts = [extra, who, place.notes].filter(Boolean);
  if (parts.length === 0) return null;
  return <p className="booking-foot">{parts.join(' · ')}</p>;
}

function FlightCard({ place, memberNames }: { place: Place; memberNames: Record<string, string> }) {
  const duration = formatDuration(place.departureTime, place.arrivalTime);
  return (
    <article className="booking-card">
      <header className="booking-head">
        <span className="booking-name">{place.name}</span>
        <span className="booking-date">{formatDate(place.departureTime)}</span>
        <StatusBadge start={place.departureTime} end={place.arrivalTime} />
      </header>
      <div className="booking-route">
        <div className="booking-end">
          <span className="booking-big">{formatTime(place.departureTime)}</span>
          <span className="booking-place">{place.departureAirport ?? '—'}</span>
        </div>
        <div className="booking-link" aria-hidden="true">
          <span className="booking-link-icon"><AirplaneTilt size={18} /></span>
          {duration && <span className="booking-link-label">{duration}</span>}
        </div>
        <div className="booking-end">
          <span className="booking-big">{formatTime(place.arrivalTime)}</span>
          <span className="booking-place">{place.arrivalAirport ?? '—'}</span>
        </div>
      </div>
      <Footer place={place} memberNames={memberNames} />
    </article>
  );
}

function HotelCard({ place, memberNames }: { place: Place; memberNames: Record<string, string> }) {
  const nights = place.checkIn && place.checkOut ? nightCount(place.checkIn, place.checkOut) : null;
  return (
    <article className="booking-card">
      <header className="booking-head">
        <span className="booking-name">{place.name}</span>
        <span className="booking-date">{formatDate(place.checkIn)}</span>
        <StatusBadge start={place.checkIn} end={place.checkOut} />
      </header>
      <div className="booking-route">
        <div className="booking-end">
          <span className="booking-big">{place.checkIn ? formatShortDate(place.checkIn) : '—'}</span>
          <span className="booking-place">Check-in {place.checkIn ? formatTime(place.checkIn) : ''}</span>
        </div>
        <div className="booking-link" aria-hidden="true">
          <span className="booking-link-icon"><Bed size={18} /></span>
          {nights !== null && <span className="booking-link-label">{nights} night{nights === 1 ? '' : 's'}</span>}
        </div>
        <div className="booking-end">
          <span className="booking-big">{place.checkOut ? formatShortDate(place.checkOut) : '—'}</span>
          <span className="booking-place">Check-out {place.checkOut ? formatTime(place.checkOut) : ''}</span>
        </div>
      </div>
      <Footer place={place} memberNames={memberNames} />
    </article>
  );
}

/** Flights and hotels from the itinerary, laid out as confirmation-style
 *  cards. Read-only: bookings are added and edited from the Itinerary tab. */
export function BookingsTab({ places, memberNames }: { places: Place[]; memberNames: Record<string, string> }) {
  const flights = places.filter((p) => p.type === 'FLIGHT').sort((a, b) => sortKey(a) - sortKey(b));
  const hotels = places.filter((p) => p.type === 'HOTEL').sort((a, b) => sortKey(a) - sortKey(b));
  const totalNights = hotels.reduce(
    (sum, h) => sum + (h.checkIn && h.checkOut ? nightCount(h.checkIn, h.checkOut) : 0),
    0,
  );

  if (flights.length === 0 && hotels.length === 0) {
    return <p className="empty-state">No bookings yet. Add a flight or hotel from the Itinerary tab and it shows up here.</p>;
  }

  return (
    <div className="bookings">
      {flights.length > 0 && (
        <section className="booking-section">
          <div className="booking-section-head">
            <h2 className="booking-section-title">Flights</h2>
            <span className="booking-section-meta">
              {flights.length} LEG{flights.length === 1 ? '' : 'S'}
            </span>
          </div>
          {flights.map((p) => (
            <FlightCard key={p.id} place={p} memberNames={memberNames} />
          ))}
        </section>
      )}
      {hotels.length > 0 && (
        <section className="booking-section">
          <div className="booking-section-head">
            <h2 className="booking-section-title">Hotels</h2>
            <span className="booking-section-meta">
              {totalNights} NIGHT{totalNights === 1 ? '' : 'S'}
            </span>
          </div>
          {hotels.map((p) => (
            <HotelCard key={p.id} place={p} memberNames={memberNames} />
          ))}
        </section>
      )}
    </div>
  );
}
