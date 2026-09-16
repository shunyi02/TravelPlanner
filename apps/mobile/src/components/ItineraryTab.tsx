import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Place } from '../api';
import { api } from '../api';
import { colors } from '../theme';

export function ItineraryTab({
  tripId,
  places,
  onChange,
}: {
  tripId: string;
  places: Place[];
  onChange: () => void;
}) {
  const [name, setName] = useState('');

  const handleAdd = async () => {
    if (!name.trim()) return;
    await api.addPlace(tripId, { name: name.trim() });
    setName('');
    onChange();
  };

  return (
    <View>
      {places.length === 0 ? (
        <Text style={styles.empty}>No stops yet. Add the first place on your itinerary.</Text>
      ) : (
        places.map((place, index) => (
          <View style={styles.row} key={place.id}>
            <View style={styles.stopIndex}>
              <Text style={styles.stopIndexText}>{index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{place.name}</Text>
              {place.notes ? <Text style={styles.rowSub}>{place.notes}</Text> : null}
            </View>
          </View>
        ))
      )}

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Add a stop (e.g. Senso-ji Temple)"
          placeholderTextColor={colors.inkSoft}
          value={name}
          onChangeText={setName}
          onSubmitEditing={handleAdd}
        />
        <Pressable style={styles.button} onPress={handleAdd}>
          <Text style={styles.buttonText}>Add stop</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.inkSoft, paddingVertical: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  stopIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.routeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stopIndexText: { color: colors.route, fontSize: 12, fontWeight: '600' },
  rowTitle: { fontSize: 15, fontWeight: '500', color: colors.ink },
  rowSub: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
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
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});
