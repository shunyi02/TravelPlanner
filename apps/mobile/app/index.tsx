import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api, type Trip } from '../src/api';
import { useTheme, type ThemeColors } from '../src/theme';
import { useAuth } from '../src/authContext';
import { AddTripModal } from '../src/components/AddTripModal';

export default function TripListScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const { logout } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .listTrips()
      .then(setTrips)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Refetch every time this screen regains focus (e.g. after adding a trip
  // or coming back from a trip detail screen where data may have changed).
  useFocusEffect(load);

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

  const handleLongPress = (trip: Trip) => {
    Alert.alert(trip.name, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Duplicate trip', onPress: () => handleDuplicate(trip) },
    ]);
  };

  return (
    <View style={styles.container}>
      {error ? (
        <Text style={styles.empty}>Couldn't load trips: {error}</Text>
      ) : loading ? (
        <Text style={styles.empty}>Loading trips…</Text>
      ) : trips.length === 0 ? (
        <Text style={styles.empty}>No trips yet. Add your first one below.</Text>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/trip/${item.id}`)}
              onLongPress={() => handleLongPress(item)}
            >
              <Text style={styles.rowTitle}>{item.name}</Text>
            </Pressable>
          )}
        />
      )}

      <Pressable style={styles.button} onPress={() => setShowModal(true)}>
        <Text style={styles.buttonText}>+ Add a trip</Text>
      </Pressable>
      <AddTripModal visible={showModal} onClose={() => setShowModal(false)} onCreated={handleCreated} />

      <View style={styles.footerLinks}>
        <Pressable onPress={() => router.push('/profile')}>
          <Text style={styles.footerLink}>Profile</Text>
        </Pressable>
        <Text style={styles.footerDivider}>·</Text>
        <Pressable onPress={() => router.push('/settings')}>
          <Text style={styles.footerLink}>Settings</Text>
        </Pressable>
        <Text style={styles.footerDivider}>·</Text>
        <Pressable onPress={logout}>
          <Text style={styles.footerLink}>Log out</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, padding: 20 },
    empty: { color: colors.inkSoft, paddingVertical: 24 },
    row: {
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.rule,
    },
    rowTitle: { fontSize: 16, fontWeight: '500', color: colors.ink },
    form: { flexDirection: 'row', gap: 8, marginTop: 16 },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      color: colors.ink,
    },
    button: {
      backgroundColor: colors.route,
      borderRadius: 6,
      paddingHorizontal: 18,
      justifyContent: 'center',
    },
    buttonText: { color: '#fff', fontWeight: '600' },
    footerLinks: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
      marginTop: 16,
    },
    footerLink: { color: colors.inkSoft },
    footerDivider: { color: colors.rule },
  });
}
