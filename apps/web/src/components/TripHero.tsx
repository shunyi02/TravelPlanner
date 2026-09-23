import type { TripDetail } from '../api';

function formatShort(iso: string): string {
  return new Date(iso.slice(0, 10) + 'T00:00:00Z')
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })
    .toUpperCase();
}

function dayCount(start: string, end: string): number {
  const ms = new Date(end.slice(0, 10) + 'T00:00:00Z').getTime() - new Date(start.slice(0, 10) + 'T00:00:00Z').getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/** "In 12 days" / "On the road" / "Wrapped up", or null without dates. */
function tripStatus(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local
  if (today < start.slice(0, 10)) {
    const n = dayCount(today, start) - 1;
    return n === 1 ? 'Tomorrow' : `In ${n} days`;
  }
  if (today <= end.slice(0, 10)) return 'On the road';
  return 'Wrapped up';
}

/** Dark banner at the top of the itinerary: dates, title, and three stat cards.
 *  Mirrors the mobile app's TripHero (apps/mobile/src/components/TripHero.tsx). */
export function TripHero({ trip }: { trip: TripDetail }) {
  const stops = trip.places.filter((p) => p.type === 'STOP').length;
  const hotels = trip.places.filter((p) => p.type === 'HOTEL').length;
  const flights = trip.places.filter((p) => p.type === 'FLIGHT').length;
  const days = trip.startDate && trip.endDate ? dayCount(trip.startDate, trip.endDate) : null;
  const status = tripStatus(trip.startDate, trip.endDate);

  const eyebrow = [
    trip.destinationName?.toUpperCase(),
    trip.startDate && trip.endDate ? `${formatShort(trip.startDate)} — ${formatShort(trip.endDate)}` : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  const subtitle = [
    `${trip.members.length} ${trip.members.length === 1 ? 'traveler' : 'travelers'}`,
    `${hotels} ${hotels === 1 ? 'hotel' : 'hotels'}`,
    `${flights} ${flights === 1 ? 'flight' : 'flights'}`,
  ].join('  ·  ');

  const stats = [
    { value: String(stops), label: stops === 1 ? 'stop planned' : 'stops planned' },
    { value: days ? `${days} ${days === 1 ? 'DAY' : 'DAYS'}` : '—', label: 'trip length' },
    { value: trip.currency, label: 'trip currency' },
  ];

  return (
    <section className="itin-hero">
      <div className="itin-hero-top">
        <p className="itin-hero-eyebrow">{eyebrow}</p>
        {status && <span className="itin-hero-badge">{status}</span>}
      </div>
      <h1 className="itin-hero-title">{trip.name}</h1>
      <p className="itin-hero-sub">{subtitle}</p>
      <div className="itin-hero-stats">
        {stats.map((s) => (
          <div key={s.label} className="itin-hero-stat">
            <span className="itin-hero-stat-value">{s.value}</span>
            <span className="itin-hero-stat-label">{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
