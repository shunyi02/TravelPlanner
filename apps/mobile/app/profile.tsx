import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../src/api';
import { useAuth } from '../src/authContext';
import { useTheme, type ThemeColors } from '../src/theme';

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export default function ProfileScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const { currentUser, setCurrentUser } = useAuth();
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!initialized && currentUser) {
      setName(currentUser.name);
      setAvatarUrl(currentUser.avatarUrl ?? null);
      setInitialized(true);
    }
  }, [currentUser, initialized]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setAvatarUrl(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api.updateProfile({ name: name.trim(), avatarUrl: avatarUrl ?? undefined });
      setCurrentUser(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  if (!currentUser) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <View style={styles.avatarRow}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{initials(name || currentUser.name)}</Text>
          </View>
        )}
        <Pressable style={styles.buttonOutline} onPress={pickImage}>
          <Text style={[styles.buttonText, { color: colors.route }]}>{avatarUrl ? 'Change photo' : 'Add photo'}</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.inkSoft} />

      <Text style={styles.label}>Email</Text>
      <Text style={styles.readOnly}>{currentUser.email}</Text>

      {error ? <Text style={{ color: colors.owe, marginTop: 8 }}>{error}</Text> : null}
      {saved ? <Text style={{ color: colors.route, marginTop: 8 }}>Saved.</Text> : null}

      <Pressable style={[styles.button, { marginTop: 16 }]} onPress={handleSave} disabled={saving}>
        <Text style={styles.buttonTextSolid}>{saving ? 'Saving…' : 'Save'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
    avatarImage: { width: 72, height: 72, borderRadius: 36 },
    avatarPlaceholder: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.routeSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: { fontSize: 22, fontWeight: '700', color: colors.route },
    label: { fontSize: 12, color: colors.inkSoft, marginTop: 16, marginBottom: 6 },
    input: {
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      color: colors.ink,
    },
    readOnly: { color: colors.inkSoft, paddingVertical: 10 },
    button: {
      backgroundColor: colors.route,
      borderRadius: 6,
      paddingVertical: 12,
      alignItems: 'center',
    },
    buttonOutline: { borderRadius: 6, paddingVertical: 8, paddingHorizontal: 14 },
    buttonText: { fontWeight: '600' },
    buttonTextSolid: { color: '#fff', fontWeight: '600' },
  });
}
