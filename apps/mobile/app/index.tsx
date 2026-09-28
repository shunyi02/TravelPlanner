import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { api, type Trip } from '../src/api';
import { radius, typeScale, useTheme, type ThemeColors } from '../src/theme';
import { useAuth } from '../src/authContext';
import { formatShort, tripStatus } from '../src/tripDates';
import { initials } from '../src/initials';
import { AddTripModal } from '../src/components/AddTripModal';
import { BrandMark } from '../src/components/BrandMark';
import { Button } from '../src/components/Button';
import { useDialog } from '../src/components/Dialog';

export default function TripListScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const showDialog = useDialog();
  const insets = useSafeAreaInsets();
  const { currentUser } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return api
      .listTrips()
      .then(setTrips)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Refetch every time this screen regains focus (e.g. after adding a trip
  // or coming back from a trip detail screen where data may have changed).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  };

  const handleRetry = () => {
    setLoading(true);
    load();
  };

  const handleCreated = (tripId: string) => {
    setShowModal(false);
    load();
    router.push(`/trip/${tripId}`);
  };

  const handleDuplicate = async (trip: Trip) => {
    try {
      const copy = await api.duplicateTrip(trip.id);
      load();
      router.push(`/trip/${copy.id}`);
    } catch (err) {
      showDialog({
        title: 'Could not duplicate trip',
        message: err instanceof Error ? err.message : 'Something went wrong. Try again.',
      });
    }
  };

  const openTripMenu = (trip: Trip) => {
    showDialog({
      title: trip.name,
      actions: [
        { label: 'Duplicate trip', onPress: () => handleDuplicate(trip) },
        { label: 'Cancel', style: 'cancel' },
      ],
    });
  };

  const headerAvatar = () => (
    <Pressable
      onPress={() => router.push('/profile')}
      accessibilityRole="button"
      accessibilityLabel="Profile and settings"
      hitSlop={8}
      style={({ pressed }) => [styles.headerAvatar, pressed && { opacity: 0.7 }]}
    >
      {currentUser?.avatarUrl ? (
        <Image source={{ uri: currentUser.avatarUrl }} style={styles.headerAvatarImage} />
      ) : (
        <Text style={styles.headerAvatarInitials}>{currentUser ? initials(currentUser.name) : ''}</Text>
      )}
    </Pressable>
  );

  const hasTrips = !loading && !error && trips.length > 0;

  let body: React.ReactNode;
  if (loading) {
    body = <SkeletonList colors={colors} />;
  } else if (error) {
    body = (
      <View style={styles.state}>
        <Text style={styles.stateTitle}>Couldn't load your trips</Text>
        <Text style={styles.stateText}>{error}</Text>
        <Button label="Try again" variant="secondary" onPress={handleRetry} style={styles.stateButton} />
      </View>
    );
  } else if (trips.length === 0) {
    body = (
      <View style={styles.state}>
        <Text style={styles.stateTitle}>No trips yet</Text>
        <Text style={styles.stateText}>
          Start one to plan stops day by day, keep bookings in one place, and split costs with the people you travel
          with.
        </Text>
        <Button label="Plan your first trip" onPress={() => setShowModal(true)} style={styles.stateButton} />
      </View>
    );
  } else {
    body = (
      <FlatList
        data={trips}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.route} />}
        renderItem={({ item }) => (
          <TripCard
            trip={item}
            colors={colors}
            onPress={() => router.push(`/trip/${item.id}`)}
            onMore={() => openTripMenu(item)}
          />
        )}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Cuti', headerTitle: () => <BrandMark />, headerRight: headerAvatar }} />
      {body}

      {hasTrips && (
        <View style={[styles.bottomBar, { paddingBottom: 12 + insets.bottom }]}>
          <Button label="New trip" onPress={() => setShowModal(true)} />
        </View>
      )}
      <AddTripModal visible={showModal} onClose={() => setShowModal(false)} onCreated={handleCreated} />
    </View>
  );
}

function TripCard({
  trip,
  colors,
  onPress,
  onMore,
}: {
  trip: Trip;
  colors: ThemeColors;
  onPress: () => void;
  onMore: () => void;
}) {
  const styles = createStyles(colors);
  const status = tripStatus(trip.startDate, trip.endDate);
  const eyebrow = [
    trip.destinationName,
    trip.startDate && trip.endDate ? `${formatShort(trip.startDate)} – ${formatShort(trip.endDate)}` : 'Dates not set',
  ]
    .filter(Boolean)
    .join(' · ');

  // The menu button sits beside the card's Pressable, not inside it: on web both render as <button>, and a
  // button nested in a button is invalid HTML.
  return (
    <View>
      <Pressable
        onPress={onPress}
        onLongPress={onMore}
        accessibilityRole="button"
        accessibilityLabel={[trip.name, trip.destinationName, status].filter(Boolean).join(', ')}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.cover}>
          {trip.coverPhoto ? (
            <Image source={{ uri: trip.coverPhoto }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            // No photo: the trip hero's dark band and ring, so the card still reads as this trip's banner.
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
              <Circle cx="100%" cy="-20" r="150" stroke={colors.highlight} strokeOpacity={0.55} strokeWidth={1} fill="none" />
            </Svg>
          )}
          {status && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{status}</Text>
            </View>
          )}
        </View>

        <View style={[styles.cardBody, styles.cardBodyWithMenu]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow} numberOfLines={1}>
              {eyebrow}
            </Text>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {trip.name}
            </Text>
          </View>
        </View>
      </Pressable>
      <Pressable
        onPress={onMore}
        accessibilityRole="button"
        accessibilityLabel={`More options for ${trip.name}`}
        hitSlop={10}
        style={({ pressed }) => [styles.moreButton, pressed && { opacity: 0.55 }]}
      >
        <Text style={styles.moreGlyph}>⋯</Text>
      </Pressable>
    </View>
  );
}

/** Card-shaped placeholders that pulse while the first load is in flight. */
function SkeletonList({ colors }: { colors: ThemeColors }) {
  const styles = createStyles(colors);
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.list} accessibilityLabel="Loading trips">
      {[0, 1, 2].map((i) => (
        <Animated.View key={i} style={[styles.card, { opacity: pulse }]}>
          <View style={[styles.cover, { backgroundColor: colors.rule }]} />
          <View style={styles.cardBody}>
            <View style={{ flex: 1, gap: 10 }}>
              <View style={[styles.skeletonLine, { width: '45%' }]} />
              <View style={[styles.skeletonLine, { width: '75%', height: 18 }]} />
            </View>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const COVER_HEIGHT = 132;
const MORE_BUTTON_SIZE = 32;

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    list: { padding: 16, gap: 16 },

    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      overflow: 'hidden',
      // Borderless on the tinted bg, as on web; a faint shadow lifts it.
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
    },
    cardPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
    cover: { height: COVER_HEIGHT, backgroundColor: colors.hero },
    badge: {
      position: 'absolute',
      top: 12,
      left: 12,
      backgroundColor: colors.highlight,
      borderRadius: radius.pill,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    badgeText: { color: colors.hero, fontWeight: '700', fontSize: typeScale.caption },
    cardBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, paddingBottom: 18 },
    eyebrow: { fontSize: typeScale.caption, fontWeight: '600', letterSpacing: 0.5, color: colors.ledger },
    cardTitle: {
      fontSize: typeScale.title2,
      lineHeight: 28,
      fontWeight: '600',
      letterSpacing: -0.3,
      color: colors.ink,
      marginTop: 6,
    },
    // Room on the right for the menu button, which overlays the card's body.
    cardBodyWithMenu: { paddingRight: 16 + MORE_BUTTON_SIZE + 12 },
    moreButton: {
      position: 'absolute',
      top: COVER_HEIGHT + 16,
      right: 16,
      width: MORE_BUTTON_SIZE,
      height: MORE_BUTTON_SIZE,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moreGlyph: { fontSize: 20, lineHeight: 22, color: colors.inkSoft },
    skeletonLine: { height: 11, borderRadius: 4, backgroundColor: colors.rule },

    state: { flex: 1, justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 48 },
    stateTitle: { fontSize: typeScale.title1, fontWeight: '700', letterSpacing: -0.5, color: colors.ink },
    stateText: { fontSize: typeScale.subhead, lineHeight: 22, color: colors.inkSoft, marginTop: 10 },
    stateButton: { alignSelf: 'flex-start', marginTop: 24 },

    bottomBar: {
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: colors.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.rule,
    },

    headerAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.routeSoft,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    headerAvatarImage: { width: 32, height: 32 },
    headerAvatarInitials: { fontSize: typeScale.footnote, fontWeight: '700', color: colors.route },
  });
}
