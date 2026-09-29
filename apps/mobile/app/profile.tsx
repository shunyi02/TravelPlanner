import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  MIN_SIGNUP_AGE,
  PASSPORT_MIN_VALID_MONTHS,
  isOldEnoughToSignUp,
  maskPassportNumber,
  passportExpiryStatus,
} from '@travel-planner/shared';
import { api, type CurrentUser, type ProfileUpdate } from '../src/api';
import { useAuth } from '../src/authContext';
import { radius, typeScale, useTheme, type ThemeColors } from '../src/theme';
import { initials } from '../src/initials';
import { Button } from '../src/components/Button';
import { CaretRight } from '../src/icons';
import { CountryField } from '../src/components/CountryField';
import { DateField } from '../src/components/DateField';
import { Field, TextField } from '../src/components/Field';
import { Tappable } from '../src/components/Tappable';

/** The plain text fields, as the inputs hold them ("" for not set). */
type TextFields = {
  name: string;
  dateOfBirth: string;
  phone: string;
  nationality: string;
  passportExpiry: string;
  homeCurrency: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  dietaryNotes: string;
};

function fieldsFrom(user: CurrentUser): TextFields {
  return {
    name: user.name,
    dateOfBirth: user.dateOfBirth ?? '',
    phone: user.phone ?? '',
    nationality: user.nationality ?? '',
    passportExpiry: user.passportExpiry ?? '',
    homeCurrency: user.homeCurrency ?? '',
    emergencyContactName: user.emergencyContactName ?? '',
    emergencyContactPhone: user.emergencyContactPhone ?? '',
    dietaryNotes: user.dietaryNotes ?? '',
  };
}

const sameFields = (a: TextFields, b: TextFields) =>
  (Object.keys(a) as Array<keyof TextFields>).every((key) => a[key] === b[key]);

/** An empty input clears the field on the server. */
const orNull = (value: string) => value.trim() || null;

export default function ProfileScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser, setCurrentUser, logout } = useAuth();
  const [fields, setFields] = useState<TextFields | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  // Passport number: only its last four characters are loaded. `passportDraft`
  // is null while showing the masked value, a string while typing a new one.
  const [passportDraft, setPassportDraft] = useState<string | null>(null);
  const [passportRevealed, setPassportRevealed] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!fields && currentUser) {
      setFields(fieldsFrom(currentUser));
      setAvatarUrl(currentUser.avatarUrl ?? null);
    }
  }, [currentUser, fields]);

  const hasPassport = currentUser?.passportNumberLast4 != null;
  const dirty =
    !!currentUser &&
    !!fields &&
    (!sameFields(fields, fieldsFrom(currentUser)) ||
      avatarUrl !== (currentUser.avatarUrl ?? null) ||
      (hasPassport ? passportDraft !== null : !!passportDraft?.trim()));

  // "Saved" shows in the save bar briefly, then the bar goes away.
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [saved]);

  if (!currentUser || !fields) return null;

  const editingPassport = !hasPassport || passportDraft !== null;
  const expiryStatus = fields.passportExpiry ? passportExpiryStatus(fields.passportExpiry) : null;
  const dobError =
    fields.dateOfBirth && !isOldEnoughToSignUp(fields.dateOfBirth)
      ? `Date of birth must make you at least ${MIN_SIGNUP_AGE}.`
      : null;

  const edited = () => {
    setSaved(false);
    setError(null);
  };

  const set = (key: keyof TextFields) => (value: string) => {
    setFields({ ...fields, [key]: value });
    edited();
  };

  const discard = () => {
    setFields(fieldsFrom(currentUser));
    setAvatarUrl(currentUser.avatarUrl ?? null);
    setPassportDraft(null);
    setPassportRevealed(null);
    setError(null);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setAvatarUrl(`data:image/jpeg;base64,${result.assets[0].base64}`);
      edited();
    }
  };

  const togglePassport = async () => {
    if (passportRevealed) {
      setPassportRevealed(null);
      return;
    }
    setRevealing(true);
    try {
      const { passportNumber } = await api.getPassportNumber();
      setPassportRevealed(passportNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load passport number');
    } finally {
      setRevealing(false);
    }
  };

  const handleSave = async () => {
    if (!dirty || !fields.name.trim() || dobError) return;

    const update: ProfileUpdate = {
      name: fields.name.trim(),
      dateOfBirth: orNull(fields.dateOfBirth),
      phone: orNull(fields.phone),
      nationality: orNull(fields.nationality),
      passportExpiry: orNull(fields.passportExpiry),
      homeCurrency: orNull(fields.homeCurrency),
      emergencyContactName: orNull(fields.emergencyContactName),
      emergencyContactPhone: orNull(fields.emergencyContactPhone),
      dietaryNotes: orNull(fields.dietaryNotes),
    };
    if (avatarUrl !== (currentUser.avatarUrl ?? null)) update.avatarUrl = avatarUrl;
    // Send the passport only when it's being changed: a new value replaces
    // it, an emptied field removes a saved one.
    if (passportDraft !== null) {
      const draft = orNull(passportDraft);
      if (draft || hasPassport) update.passportNumber = draft;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateProfile(update);
      setCurrentUser(updated);
      setFields(fieldsFrom(updated));
      setAvatarUrl(updated.avatarUrl ?? null);
      setPassportDraft(null);
      setPassportRevealed(null);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const showSaveBar = dirty || saving || saved || !!error;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, showSaveBar && { paddingBottom: 120 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.identity}>
        <Tappable onPress={pickImage} accessibilityRole="button" accessibilityLabel={avatarUrl ? 'Change photo' : 'Add photo'}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{initials(fields.name || currentUser.name)}</Text>
            </View>
          )}
        </Tappable>
        <Text style={styles.identityName}>{fields.name.trim() || currentUser.name}</Text>
        <Text style={styles.identityEmail}>{currentUser.email}</Text>
        <View style={styles.identityActions}>
          <Button label={avatarUrl ? 'Change photo' : 'Add photo'} variant="text" onPress={pickImage} />
          {avatarUrl ? (
            <Button
              label="Remove photo"
              variant="text"
              tone="danger"
              onPress={() => {
                setAvatarUrl(null);
                edited();
              }}
            />
          ) : null}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Personal</Text>
      <View style={[styles.card, { zIndex: 2 }]}>
        <TextField
          label="Name"
          value={fields.name}
          onChangeText={set('name')}
          autoComplete="name"
          error={fields.name.trim() ? null : "Your name can't be empty."}
        />
        <DateField
          label="Date of birth"
          value={fields.dateOfBirth}
          onChange={set('dateOfBirth')}
          optional
          defaultDay="1990-01-01"
          error={dobError}
        />
        <TextField
          label="Phone"
          value={fields.phone}
          onChangeText={set('phone')}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder="+65 9123 4567"
        />
        <CountryField label="Nationality" value={fields.nationality} onChange={set('nationality')} />
      </View>

      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, styles.sectionTitleInRow]}>Travel documents</Text>
        {expiryStatus === 'expired' ? (
          <Text style={[styles.badge, styles.badgeExpired]}>Expired</Text>
        ) : expiryStatus === 'expiring' ? (
          <Text style={styles.badge}>Under {PASSPORT_MIN_VALID_MONTHS} months left</Text>
        ) : null}
      </View>
      <View style={styles.card}>
        {editingPassport ? (
          <>
            <TextField
              label="Passport number"
              value={passportDraft ?? ''}
              onChangeText={(v) => {
                setPassportDraft(v);
                edited();
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              maxLength={24}
              hint={`Encrypted when saved. Only you can see it.${hasPassport ? ' Leave empty and save to remove it.' : ''}`}
            />
            {hasPassport && (
              <Button
                label="Keep current number"
                variant="text"
                size="sm"
                onPress={() => setPassportDraft(null)}
                style={styles.keepPassport}
              />
            )}
          </>
        ) : (
          <Field label="Passport number">
            <View style={styles.passportRow}>
              <Text style={styles.passportValue}>
                {passportRevealed ?? maskPassportNumber(currentUser.passportNumberLast4!)}
              </Text>
              <Button
                label={passportRevealed ? 'Hide' : revealing ? 'Loading…' : 'Show'}
                variant="text"
                size="sm"
                onPress={togglePassport}
                disabled={revealing}
              />
              <Button
                label="Change"
                variant="text"
                size="sm"
                onPress={() => {
                  setPassportRevealed(null);
                  setPassportDraft('');
                }}
              />
            </View>
          </Field>
        )}
        <DateField
          label="Passport expiry"
          value={fields.passportExpiry}
          onChange={set('passportExpiry')}
          optional
        />
        {expiryStatus === 'expired' && <Text style={styles.expiry}>Renew it before your next trip.</Text>}
        {expiryStatus === 'expiring' && (
          <Text style={styles.expiry}>Many countries refuse entry with under {PASSPORT_MIN_VALID_MONTHS} months left.</Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>Emergency contact</Text>
      <View style={styles.card}>
        <TextField
          label="Name"
          value={fields.emergencyContactName}
          onChangeText={set('emergencyContactName')}
          maxLength={100}
        />
        <TextField
          label="Phone"
          value={fields.emergencyContactPhone}
          onChangeText={set('emergencyContactPhone')}
          keyboardType="phone-pad"
        />
      </View>

      <Text style={styles.sectionTitle}>Travel preferences</Text>
      <View style={styles.card}>
        <TextField
          label="Home currency"
          value={fields.homeCurrency}
          onChangeText={(v) => set('homeCurrency')(v.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={3}
          placeholder="SGD"
          hint="New trips start in this currency."
        />
        <TextField
          label="Dietary or medical notes"
          value={fields.dietaryNotes}
          onChangeText={set('dietaryNotes')}
          multiline
          maxLength={500}
          placeholder="e.g. vegetarian, nut allergy"
          style={styles.notes}
        />
      </View>

      <View style={styles.card}>
        <Tappable onPress={() => router.push('/settings')} accessibilityRole="button" style={styles.linkRow}>
          <Text style={styles.linkRowText}>Appearance and theme</Text>
          <CaretRight size={16} color={colors.inkSoft} />
        </Tappable>
      </View>

      <Button label="Log out" variant="secondary" tone="danger" onPress={logout} style={styles.logout} />
      </ScrollView>

      {showSaveBar && (
        <View style={[styles.saveBar, { bottom: 16 + insets.bottom }]} accessibilityLiveRegion="polite">
          <Text style={[styles.saveStatus, !!error && styles.saveStatusError]} numberOfLines={2}>
            {error ?? (saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved')}
          </Text>
          {dirty ? (
            <>
              <Button label="Discard" variant="text" size="sm" onPress={discard} disabled={saving} />
              <Button
                label={saving ? 'Saving…' : 'Save'}
                size="sm"
                onPress={handleSave}
                disabled={saving || !fields.name.trim() || !!dobError}
              />
            </>
          ) : null}
        </View>
      )}
    </View>
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
    sectionTitle: {
      fontSize: typeScale.footnote,
      fontWeight: '600',
      color: colors.inkSoft,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 8,
      marginLeft: 4,
    },
    card: { padding: 16, paddingBottom: 2, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: 20 },
    identityName: { fontSize: typeScale.body, fontWeight: '700', color: colors.ink, marginTop: 8, textAlign: 'center' },
    identityEmail: { fontSize: typeScale.footnote, color: colors.inkSoft, textAlign: 'center' },
    identityActions: { flexDirection: 'row', gap: 20, marginTop: 4 },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8, marginLeft: 4 },
    sectionTitleInRow: { marginBottom: 0, marginLeft: 0 },
    badge: {
      overflow: 'hidden',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.sm,
      fontSize: typeScale.caption,
      fontWeight: '600',
      color: colors.ledger,
      backgroundColor: colors.ledgerSoft,
    },
    badgeExpired: { color: colors.owe, backgroundColor: colors.oweSoft },
    passportRow: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 36 },
    passportValue: { flex: 1, fontSize: typeScale.subhead, color: colors.ink, letterSpacing: 0.6, fontVariant: ['tabular-nums'] },
    keepPassport: { alignSelf: 'flex-start', marginTop: -6, marginBottom: 14 },
    expiry: { fontSize: typeScale.caption, color: colors.inkSoft, marginTop: -8, marginBottom: 14 },
    notes: { minHeight: 88, textAlignVertical: 'top' },
    saveBar: {
      position: 'absolute',
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      paddingLeft: 16,
      paddingRight: 10,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.rule,
      backgroundColor: colors.surface,
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
    },
    saveStatus: { flex: 1, fontSize: typeScale.footnote, fontWeight: '600', color: colors.ink },
    saveStatusError: { color: colors.owe },
    linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 },
    linkRowText: { fontSize: typeScale.subhead, color: colors.ink },
    logout: { marginTop: 8 },
  });
}
