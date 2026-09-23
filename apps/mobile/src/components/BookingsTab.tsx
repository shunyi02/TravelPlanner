import { StyleSheet, Text, View } from 'react-native';
import type { Place } from '../api';
import { fonts, useTheme, type ThemeColors } from '../theme';

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

type Styles = ReturnType<typeof createStyles>;

function BookingCard({
  place,
  memberNames,
  styles,
  start,
  end,
  left,
  right,
  icon,
  linkLabel,
}: {
  place: Place;
  memberNames: Record<string, string>;
  styles: Styles;
  start: string | null;
  end: string | null;
  left: { big: string; small: string };
  right: { big: string; small: string };
  icon: string;
  linkLabel: string | null;
}) {
  const status = bookingStatus(start, end);
  const who =
    place.assignments.length > 0 ? `For ${place.assignments.map((a) => memberNames[a.userId] ?? a.userId).join(', ')}` : null;
  const foot = [who, place.notes].filter(Boolean).join(' · ');

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.name} numberOfLines={1}>
          {place.name}
        </Text>
        <Text style={styles.date}>{formatDate(start)}</Text>
        {status && (
          <View style={[styles.badge, status.past && styles.badgePast]}>
            <Text style={[styles.badgeText, status.past && styles.badgeTextPast]}>{status.label}</Text>
          </View>
        )}
      </View>

      <View style={styles.route}>
        <View style={styles.end}>
          <Text style={styles.big}>{left.big}</Text>
          <Text style={styles.place}>{left.small}</Text>
        </View>
        <View style={styles.link}>
          <View style={styles.linkLineRow}>
            <View style={styles.linkLine} />
            <Text style={styles.linkIcon}>{icon}</Text>
            <View style={styles.linkLine} />
          </View>
          {linkLabel && <Text style={styles.linkLabel}>{linkLabel}</Text>}
        </View>
        <View style={styles.end}>
          <Text style={styles.big}>{right.big}</Text>
          <Text style={styles.place}>{right.small}</Text>
        </View>
      </View>

      {foot.length > 0 && <Text style={styles.foot}>{foot}</Text>}
    </View>
  );
}

/** Flights and hotels from the itinerary, laid out as confirmation-style
 *  cards. Read-only: bookings are added and edited from the Itinerary tab.
 *  Mirrors the web app's BookingsTab (apps/web/src/components/BookingsTab.tsx). */
export function BookingsTab({ places, memberNames }: { places: Place[]; memberNames: Record<string, string> }) {
  const colors = useTheme();
  const styles = createStyles(colors);

  const flights = places.filter((p) => p.type === 'FLIGHT').sort((a, b) => sortKey(a) - sortKey(b));
  const hotels = places.filter((p) => p.type === 'HOTEL').sort((a, b) => sortKey(a) - sortKey(b));
  const totalNights = hotels.reduce(
    (sum, h) => sum + (h.checkIn && h.checkOut ? nightCount(h.checkIn, h.checkOut) : 0),
    0,
  );

  if (flights.length === 0 && hotels.length === 0) {
    return (
      <Text style={styles.empty}>No bookings yet. Add a flight or hotel from the Itinerary tab and it shows up here.</Text>
    );
  }

  return (
    <View>
      {flights.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Flights</Text>
            <Text style={styles.sectionMeta}>
              {flights.length} LEG{flights.length === 1 ? '' : 'S'}
            </Text>
          </View>
          {flights.map((p) => (
            <BookingCard
              key={p.id}
              place={p}
              memberNames={memberNames}
              styles={styles}
              start={p.departureTime}
              end={p.arrivalTime}
              left={{ big: formatTime(p.departureTime), small: p.departureAirport ?? '—' }}
              right={{ big: formatTime(p.arrivalTime), small: p.arrivalAirport ?? '—' }}
              icon="✈"
              linkLabel={formatDuration(p.departureTime, p.arrivalTime)}
            />
          ))}
        </View>
      )}
      {hotels.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Hotels</Text>
            <Text style={styles.sectionMeta}>
              {totalNights} NIGHT{totalNights === 1 ? '' : 'S'}
            </Text>
          </View>
          {hotels.map((p) => {
            const nights = p.checkIn && p.checkOut ? nightCount(p.checkIn, p.checkOut) : null;
            return (
              <BookingCard
                key={p.id}
                place={p}
                memberNames={memberNames}
                styles={styles}
                start={p.checkIn}
                end={p.checkOut}
                left={{
                  big: p.checkIn ? formatShortDate(p.checkIn) : '—',
                  small: `Check-in ${p.checkIn ? formatTime(p.checkIn) : ''}`,
                }}
                right={{
                  big: p.checkOut ? formatShortDate(p.checkOut) : '—',
                  small: `Check-out ${p.checkOut ? formatTime(p.checkOut) : ''}`,
                }}
                icon="🏨"
                linkLabel={nights !== null ? `${nights} night${nights === 1 ? '' : 's'}` : null}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    empty: { color: colors.inkSoft },
    section: { marginBottom: 24 },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sectionTitle: { fontFamily: fonts.serif, fontSize: 24, fontWeight: '700', color: colors.hero },
    sectionMeta: { fontFamily: fonts.mono, fontSize: 13, letterSpacing: 1.5, color: colors.inkSoft },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.rule,
      borderWidth: 1,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 12,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    name: { flex: 1, fontWeight: '700', color: colors.ink, fontSize: 15 },
    date: { fontFamily: fonts.mono, fontSize: 13, color: colors.inkSoft },
    badge: { backgroundColor: colors.highlight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    badgePast: { backgroundColor: colors.bg, borderColor: colors.rule, borderWidth: 1 },
    badgeText: { color: colors.hero, fontWeight: '700', fontSize: 12 },
    badgeTextPast: { color: colors.inkSoft },
    route: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 4 },
    end: { flex: 1, alignItems: 'center' },
    big: { fontFamily: fonts.mono, fontSize: 24, fontWeight: '600', color: colors.hero },
    place: { fontSize: 13, color: colors.inkSoft, marginTop: 4, textAlign: 'center' },
    link: { width: 76, alignItems: 'center' },
    linkLineRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: 4 },
    // Solid hairlines: RN's single-side dashed borders render inconsistently.
    linkLine: { flex: 1, height: 1, backgroundColor: colors.rule },
    linkIcon: { fontSize: 16, color: colors.hero },
    linkLabel: { fontFamily: fonts.mono, fontSize: 12, color: colors.inkSoft, marginTop: 4 },
    foot: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.rule,
      fontSize: 13,
      color: colors.inkSoft,
    },
  });
}
