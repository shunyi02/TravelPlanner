import { useState } from 'react';
import { Image, Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../api';
import { radius, typeScale, useTheme, type ThemeColors } from '../theme';
import { Button } from './Button';

export function AddTripModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (tripId: string) => void;
}) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      const asset = result.assets[0];
      setCoverPhoto(`data:image/jpeg;base64,${asset.base64}`);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const trip = await api.createTrip({
        name: name.trim(),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        coverPhoto: coverPhoto || undefined,
        currency: currency.trim() || undefined,
      });
      setName('');
      setStartDate('');
      setEndDate('');
      setCoverPhoto(null);
      setCurrency('USD');
      onCreated(trip.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create trip');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>New trip</Text>

          {coverPhoto && <Image source={{ uri: coverPhoto }} style={styles.preview} />}
          <Button label={coverPhoto ? 'Change photo' : 'Add cover photo'} variant="secondary" onPress={pickImage} />

          <TextInput
            style={styles.input}
            placeholder="Trip name"
            placeholderTextColor={colors.inkSoft}
            value={name}
            onChangeText={setName}
            autoFocus
          />

          {/* No native date-picker lib installed — plain YYYY-MM-DD text fields for now.
              Swap for @react-native-community/datetimepicker if a real picker is wanted. */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Start (YYYY-MM-DD)"
              placeholderTextColor={colors.inkSoft}
              value={startDate}
              onChangeText={setStartDate}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="End (YYYY-MM-DD)"
              placeholderTextColor={colors.inkSoft}
              value={endDate}
              onChangeText={setEndDate}
            />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Currency (e.g. USD)"
            placeholderTextColor={colors.inkSoft}
            autoCapitalize="characters"
            maxLength={3}
            value={currency}
            onChangeText={(v) => setCurrency(v.toUpperCase())}
          />

          {error && <Text style={{ color: colors.owe }}>{error}</Text>}

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Button label="Cancel" variant="text" onPress={onClose} style={{ paddingHorizontal: 12 }} />
            <Button label={saving ? 'Saving…' : 'Save'} onPress={handleSave} disabled={saving} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', padding: 24 },
    sheet: { backgroundColor: colors.surface, borderRadius: radius.sm, padding: 20, gap: 12 },
    title: { fontSize: typeScale.title2, fontWeight: '600', color: colors.ink },
    preview: { width: '100%', height: 140, borderRadius: radius.sm },
    input: {
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      color: colors.ink,
    },
  });
}