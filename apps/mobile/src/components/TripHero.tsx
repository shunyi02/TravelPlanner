import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { TripDetail } from '../api';
import { radius, typeScale, useTheme, type ThemeColors } from '../theme';
import { dayCount, formatShort, tripStatus } from '../tripDates';
import { CalendarBlank, PencilSimple } from '../icons';
import { Tappable } from './Tappable';

/** Full-bleed dark banner at the top of the trip: dates, title, and three stat cards.
 *  The dates double as the way to change them, as on web. */
export function TripHero({ trip, onEditDates }: { trip: TripDetail; onEditDates: () => void }) {
  const colors = useTheme();
  const styles = createStyles(colors);

  const stops = trip.places.filter((p) => p.type === 'STOP').length;
  const hotels = trip.places.filter((p) => p.type === 'HOTEL').length;
  const flights = trip.places.filter((p) => p.type === 'FLIGHT').length;
  const days = trip.startDate && trip.endDate ? dayCount(trip.startDate, trip.endDate) : null;
  const status = tripStatus(trip.startDate, trip.endDate);

  const dateLabel = trip.startDate && trip.endDate ? `${formatShort(trip.startDate)} — ${formatShort(trip.endDate)}` : null;

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
        <View style={styles.eyebrowRow}>
          {trip.destinationName ? (
            <>
              <Text style={styles.eyebrow} numberOfLines={1}>
                {trip.destinationName.toUpperCase()}
              </Text>
              {/* A spaced separator of its own: trailing spaces in a Text get trimmed on web. */}
              <Text style={[styles.eyebrow, styles.separator]}>·</Text>
            </>
          ) : null}
          <Tappable
            onPress={onEditDates}
            accessibilityRole="button"
            accessibilityLabel={dateLabel ? `Trip dates ${dateLabel}. Change dates` : 'Add trip dates'}
            hitSlop={8}
            style={styles.dates}
          >
            {dateLabel ? (
              <>
                <Text style={styles.eyebrow}>{dateLabel.toUpperCase()}</Text>
                <PencilSimple size={13} color={colors.onHeroSoft} weight="bold" />
              </>
            ) : (
              <>
                <CalendarBlank size={14} color={colors.highlight} weight="bold" />
                <Text style={[styles.eyebrow, { color: colors.highlight }]}>ADD DATES</Text>
              </>
            )}
          </Tappable>
        </View>
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
    eyebrowRow: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
    separator: { marginHorizontal: 8 },
    dates: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    eyebrow: { fontSize: typeScale.footnote, fontWeight: '600', letterSpacing: 1.5, color: colors.onHeroSoft },
    badge: { backgroundColor: colors.highlight, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
    badgeText: { color: colors.hero, fontWeight: '700', fontSize: typeScale.footnote },
    title: {
      fontSize: typeScale.largeTitle,
      lineHeight: 40,
      fontWeight: '700',
      letterSpacing: -0.5,
      color: colors.onHero,
      marginTop: 36,
    },
    subtitle: { fontSize: typeScale.subhead, color: colors.onHeroSoft, marginTop: 8 },
    statRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
    stat: {
      flex: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderColor: 'rgba(255, 255, 255, 0.14)',
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: 12,
      paddingVertical: 14,
    },
    statValue: {
      fontSize: typeScale.title2,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      color: colors.highlight,
    },
    statLabel: { fontSize: typeScale.caption, color: colors.onHeroSoft, marginTop: 6 },
  });
}
