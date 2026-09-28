import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { api, type Trip } from '../src/api';
import { fonts, useTheme, type ThemeColors } from '../src/theme';
import { useAuth } from '../src/authContext';
import { formatShort, tripStatus } from '../src/tripDates';
import { initials } from '../src/initials';
import { AddTripModal } from '../src/components/AddTripModal';
import { Button } from '../src/components/Button';

export default function TripListScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const router = useRouter();
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
      Alert.alert('Could not duplicate trip', err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  const openTripMenu = (trip: Trip) => {
    Alert.alert(trip.name, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Duplicate trip', onPress: () => handleDuplicate(trip) },
    ]);
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
      <Stack.Screen options={{ title: 'Your trips', headerRight: headerAvatar }} />
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
    trip.destinationName?.toUpperCase(),
    trip.startDate && trip.endDate ? `${formatShort(trip.startDate)} — ${formatShort(trip.endDate)}` : 'DATES NOT SET',
  ]
    .filter(Boolean)
    .join('  ·  ');

  return (
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

      <View style={styles.cardBody}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow} numberOfLines={1}>
            {eyebrow}
          </Text>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {trip.name}
          </Text>
        </View>
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
    </Pressable>
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    list: { padding: 16, gap: 16 },

    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.rule,
    },
    cardPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
    cover: { height: 132, backgroundColor: colors.hero },
    badge: {
      position: 'absolute',
      top: 12,
      left: 12,
      backgroundColor: colors.highlight,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    badgeText: { color: colors.hero, fontWeight: '700', fontSize: 12 },
    cardBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, paddingBottom: 18 },
    eyebrow: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, color: colors.inkSoft },
    cardTitle: {
      fontFamily: fonts.serif,
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '700',
      color: colors.ink,
      marginTop: 6,
    },
    moreButton: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    moreGlyph: { fontSize: 20, lineHeight: 22, color: colors.inkSoft },
    skeletonLine: { height: 11, borderRadius: 4, backgroundColor: colors.rule },

    state: { flex: 1, justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 48 },
    stateTitle: { fontFamily: fonts.serif, fontSize: 26, fontWeight: '700', color: colors.ink },
    stateText: { fontSize: 15, lineHeight: 22, color: colors.inkSoft, marginTop: 10 },
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
    headerAvatarInitials: { fontSize: 13, fontWeight: '700', color: colors.route },
  });
}
