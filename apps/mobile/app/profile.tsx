import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../src/api';
import { useAuth } from '../src/authContext';
import { radius, typeScale, useTheme, type ThemeColors } from '../src/theme';
import { initials } from '../src/initials';
import { Button } from '../src/components/Button';
import { CaretRight } from '../src/icons';
import { TextField } from '../src/components/Field';
import { Tappable } from '../src/components/Tappable';

export default function ProfileScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const { currentUser, setCurrentUser, logout } = useAuth();
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.identity}>
        <Tappable onPress={pickImage} accessibilityRole="button" accessibilityLabel={avatarUrl ? 'Change photo' : 'Add photo'}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{initials(name || currentUser.name)}</Text>
            </View>
          )}
        </Tappable>
        <Button label={avatarUrl ? 'Change photo' : 'Add photo'} variant="text" onPress={pickImage} />
      </View>

      <View style={styles.card}>
        <TextField
          label="Name"
          value={name}
          onChangeText={(v) => {
            setName(v);
            setSaved(false);
          }}
          error={name.trim() ? error : "Your name can't be empty."}
        />
        <Text style={styles.label}>Email</Text>
        <Text style={styles.readOnly}>{currentUser.email}</Text>
        <View style={styles.saveRow}>
          {saved ? <Text style={styles.saved}>Saved</Text> : <View />}
          <Button label={saving ? 'Saving…' : 'Save'} size="sm" onPress={handleSave} disabled={saving || !name.trim()} />
        </View>
      </View>

      <View style={styles.card}>
        <Tappable onPress={() => router.push('/settings')} accessibilityRole="button" style={styles.linkRow}>
          <Text style={styles.linkRowText}>Appearance and theme</Text>
          <CaretRight size={16} color={colors.inkSoft} />
        </Tappable>
      </View>

      <Button label="Log out" variant="secondary" tone="danger" onPress={logout} style={styles.logout} />
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 20, paddingBottom: 48, width: '100%', maxWidth: 560, alignSelf: 'center' },
    identity: { alignItems: 'center', gap: 4, marginBottom: 20 },
    avatarImage: { width: 88, height: 88, borderRadius: radius.lg + 8 },
    avatarPlaceholder: {
      width: 88,
      height: 88,
      borderRadius: radius.lg + 8,
      backgroundColor: colors.routeSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: { fontSize: typeScale.title1, fontWeight: '700', color: colors.route },
    card: { padding: 16, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: 16 },
    label: { fontSize: typeScale.footnote, fontWeight: '600', color: colors.inkSoft, marginBottom: 4 },
    readOnly: { fontSize: typeScale.subhead, color: colors.ink },
    saveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
    saved: { fontSize: typeScale.footnote, fontWeight: '600', color: colors.route },
    linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 },
    linkRowText: { fontSize: typeScale.subhead, color: colors.ink },
    logout: { marginTop: 8 },
  });
}
