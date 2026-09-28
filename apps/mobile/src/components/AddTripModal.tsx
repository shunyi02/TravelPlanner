import { useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { radius, typeScale, useTheme, type ThemeColors } from '../theme';
import { Button } from './Button';
import { DateField } from './DateField';
import { TextField } from './Field';
import { Tappable } from './Tappable';

/** The "new trip" sheet: a cover, a name, the dates and the trip currency. */
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
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const backwards = Boolean(startDate && endDate && endDate < startDate);

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

  const reset = () => {
    setName('');
    setStartDate('');
    setEndDate('');
    setCoverPhoto(null);
    setCurrency('USD');
    setError(null);
    setNameError(null);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setNameError('Give the trip a name.');
      return;
    }
    if (backwards) return;
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
      reset();
      onCreated(trip.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the trip');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.head}>
          <Button label="Cancel" variant="text" onPress={onClose} />
          <Text style={styles.title}>New trip</Text>
          <Button label={saving ? 'Creating…' : 'Create'} variant="text" onPress={handleSave} disabled={saving} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Tappable
            onPress={pickImage}
            style={styles.cover}
            accessibilityRole="button"
            accessibilityLabel={coverPhoto ? 'Change cover photo' : 'Add a cover photo'}
          >
            {coverPhoto ? (
              <Image source={{ uri: coverPhoto }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              // Same banner as a trip card without a photo, so the preview matches the list.
              <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                <Circle cx="100%" cy="-20" r="150" stroke={colors.highlight} strokeOpacity={0.55} strokeWidth={1} fill="none" />
              </Svg>
            )}
            <View style={styles.coverChip}>
              <Text style={styles.coverChipText}>{coverPhoto ? 'Change photo' : 'Add a cover photo'}</Text>
            </View>
          </Tappable>

          <TextField
            label="Trip name"
            placeholder="e.g. Kyoto in autumn"
            value={name}
            onChangeText={(v) => {
              setName(v);
              if (nameError) setNameError(null);
            }}
            error={nameError}
            autoFocus
          />

          <View style={styles.pair}>
            <View style={{ flex: 1 }}>
              <DateField label="First day" value={startDate} onChange={setStartDate} optional />
            </View>
            <View style={{ flex: 1 }}>
              <DateField
                label="Last day"
                value={endDate}
                onChange={setEndDate}
                defaultDay={startDate}
                optional
                error={backwards ? 'Before the first day' : null}
              />
            </View>
          </View>

          <TextField
            label="Currency"
            hint="The currency expenses are shown in. You can change it later."
            autoCapitalize="characters"
            maxLength={3}
            value={currency}
            onChangeText={(v) => setCurrency(v.toUpperCase())}
            style={{ width: 110 }}
          />

          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sheet: { flex: 1, backgroundColor: colors.bg },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.rule,
    },
    title: { fontSize: typeScale.body, fontWeight: '600', color: colors.ink },
    body: { padding: 20 },
    cover: {
      height: 150,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.hero,
      justifyContent: 'flex-end',
      padding: 12,
      marginBottom: 22,
    },
    coverChip: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
    },
    coverChipText: { fontSize: typeScale.footnote, fontWeight: '600', color: '#ffffff' },
    pair: { flexDirection: 'row', gap: 12 },
    error: { fontSize: typeScale.footnote, color: colors.owe, marginTop: 4 },
  });
}
