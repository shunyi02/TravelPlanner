import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { TripDetail } from '../api';
import { fonts, useTheme, type ThemeColors } from '../theme';

const CREAM = '#f6f0e1';
const CREAM_SOFT = 'rgba(246, 240, 225, 0.72)';

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

/** Full-bleed dark banner at the top of the itinerary: dates, title, and three stat cards. */
export function TripHero({ trip }: { trip: TripDetail }) {
  const colors = useTheme();
  const styles = createStyles(colors);

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
    <View style={styles.hero}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx="105%" cy="-10" r="230" stroke={colors.highlight} strokeOpacity={0.55} strokeWidth={1} fill="none" />
      </Svg>

      <View style={styles.topRow}>
        <Text style={styles.eyebrow} numberOfLines={1}>
          {eyebrow}
        </Text>
        {status && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{status}</Text>
          </View>
        )}
      </View>

      <Text style={styles.title}>{trip.name}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.statRow}>
        {stats.map((s) => (
          <View key={s.label} style={styles.stat}>
            <Text style={styles.statValue} numberOfLines={1}>
              {s.value}
            </Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    hero: {
      backgroundColor: colors.hero,
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 28,
      overflow: 'hidden',
    },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    eyebrow: { flex: 1, fontFamily: fonts.mono, fontSize: 13, letterSpacing: 2, color: CREAM_SOFT },
    badge: { backgroundColor: colors.highlight, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
    badgeText: { color: colors.hero, fontWeight: '700', fontSize: 13 },
    title: {
      fontFamily: fonts.serif,
      fontSize: 40,
      lineHeight: 48,
      fontWeight: '700',
      color: CREAM,
      marginTop: 36,
    },
    subtitle: { fontSize: 15, color: CREAM_SOFT, marginTop: 8 },
    statRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
    stat: {
      flex: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderColor: 'rgba(255, 255, 255, 0.14)',
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 14,
    },
    statValue: { fontFamily: fonts.mono, fontSize: 20, fontWeight: '700', color: colors.highlight },
    statLabel: { fontSize: 12, color: CREAM_SOFT, marginTop: 6 },
  });
}
