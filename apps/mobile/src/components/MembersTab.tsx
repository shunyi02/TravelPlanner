import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { TripDetail } from '../api';
import { api } from '../api';
import { initials } from '../initials';
import { radius, typeScale, useTheme, type ThemeColors } from '../theme';
import { Button } from './Button';
import { TextField } from './Field';

export function MembersTab({
  tripId,
  trip,
  isOwner,
  onChange,
}: {
  tripId: string;
  trip: TripDetail;
  isOwner: boolean;
  onChange: () => void;
}) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const handleAddMember = async () => {
    if (!name.trim()) {
      setNameError('Enter their name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.addManualMember(tripId, { name: name.trim(), email: email.trim() || undefined });
      setName('');
      setEmail('');
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add member');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await api.cancelInvite(tripId, inviteId);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel invite');
    }
  };

  const rows = trip.members.length + trip.invites.length;

  return (
    <View>
      <Text style={styles.heading}>
        {trip.members.length} {trip.members.length === 1 ? 'traveler' : 'travelers'}
        {trip.invites.length > 0 ? ` · ${trip.invites.length} invited` : ''}
      </Text>
      <View style={styles.card}>
        {trip.members.map((m, i) => (
          <View style={[styles.row, i < rows - 1 && styles.divider]} key={m.userId}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(m.user.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{m.user.name}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {m.user.isPlaceholder ? 'Added by name, no account yet' : m.user.email}
              </Text>
            </View>
            {m.role === 'owner' && <Text style={styles.tag}>Organizer</Text>}
          </View>
        ))}

        {trip.invites.map((invite, i) => (
          <View style={[styles.row, trip.members.length + i < rows - 1 && styles.divider]} key={invite.id}>
            <View style={[styles.avatar, styles.avatarPending]}>
              <Text style={[styles.avatarText, { color: colors.inkSoft }]}>@</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {invite.email}
              </Text>
              <Text style={styles.rowSub}>Invite sent, not joined yet</Text>
            </View>
            {isOwner && (
              <Button label="Cancel" variant="text" tone="danger" onPress={() => handleCancelInvite(invite.id)} />
            )}
          </View>
        ))}
      </View>

      {isOwner && (
        <View style={styles.addCard}>
          <Text style={styles.addTitle}>Add someone</Text>
          <Text style={styles.addText}>
            Add them by name to split costs straight away. With an email, they can also sign in and see the trip.
          </Text>
          <TextField
            label="Name"
            value={name}
            onChangeText={(v) => {
              setName(v);
              if (nameError) setNameError(null);
            }}
            error={nameError}
          />
          <TextField
            label="Email"
            placeholder="Optional"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Button label={saving ? 'Adding…' : 'Add to trip'} onPress={handleAddMember} disabled={saving} />
        </View>
      )}
      {!isOwner && error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    heading: { fontSize: typeScale.footnote, fontWeight: '600', color: colors.inkSoft, marginBottom: 8 },
    card: { borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: 14 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: radius.sm + 3,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.routeSoft,
    },
    avatarPending: { backgroundColor: colors.bg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.rule },
    avatarText: { fontSize: typeScale.footnote, fontWeight: '700', color: colors.route },
    rowTitle: { fontSize: typeScale.subhead, fontWeight: '600', color: colors.ink },
    rowSub: { fontSize: typeScale.footnote, color: colors.inkSoft, marginTop: 1 },
    tag: { fontSize: typeScale.caption, fontWeight: '600', color: colors.ledger },
    addCard: { marginTop: 24, padding: 16, borderRadius: radius.md, backgroundColor: colors.surface },
    addTitle: { fontSize: typeScale.body, fontWeight: '600', color: colors.ink },
    addText: { fontSize: typeScale.footnote, lineHeight: 18, color: colors.inkSoft, marginTop: 4, marginBottom: 16 },
    error: { fontSize: typeScale.footnote, color: colors.owe, marginBottom: 10 },
  });
}
