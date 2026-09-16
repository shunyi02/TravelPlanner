import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api, type Trip } from '../src/api';
import { colors } from '../src/theme';
import { useAuth } from '../src/authContext';

export default function TripListScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTripName, setNewTripName] = useState('');
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

  const handleCreate = async () => {
    if (!newTripName.trim()) return;
    await api.createTrip({ name: newTripName.trim() });
    setNewTripName('');
    load();
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
            <Pressable style={styles.row} onPress={() => router.push(`/trip/${item.id}`)}>
              <Text style={styles.rowTitle}>{item.name}</Text>
            </Pressable>
          )}
        />
      )}

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="New trip name"
          placeholderTextColor={colors.inkSoft}
          value={newTripName}
          onChangeText={setNewTripName}
          onSubmitEditing={handleCreate}
        />
        <Pressable style={styles.button} onPress={handleCreate}>
          <Text style={styles.buttonText}>Add</Text>
        </Pressable>
      </View>

      <Pressable onPress={logout} style={{ marginTop: 16 }}>
        <Text style={{ color: colors.inkSoft, textAlign: 'center' }}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
