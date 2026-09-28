import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { TripDetail } from '../api';
import { api } from '../api';
import { radius, typeScale, useTheme, type ThemeColors } from '../theme';
import { Button } from './Button';

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

  const handleAddMember = async () => {
    if (!name.trim()) return;
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

  return (
    <View>
      {trip.members.map((m) => (
        <View style={styles.row} key={m.userId}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{m.user.name}</Text>
            {!m.user.isPlaceholder && <Text style={styles.rowSub}>{m.user.email}</Text>}
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {m.role === 'owner' && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>owner</Text>
              </View>
            )}
            {m.user.isPlaceholder && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>not registered</Text>
              </View>
            )}
          </View>
        </View>
      ))}

      {trip.invites.map((invite) => (
        <View style={styles.row} key={invite.id}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.rowTitle}>{invite.email}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>pending</Text>
            </View>
          </View>
          {isOwner && (
            <Button label="Cancel" variant="text" tone="danger" onPress={() => handleCancelInvite(invite.id)} />
          )}
        </View>
      ))}

      {isOwner && (
        <View>
          <View style={styles.form}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Name"
              placeholderTextColor={colors.inkSoft}
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Email (optional)"
              placeholderTextColor={colors.inkSoft}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <Button
            label={saving ? 'Adding…' : 'Add member'}
            onPress={handleAddMember}
            disabled={saving}
            style={{ marginTop: 8 }}
          />
        </View>
      )}
      {error && <Text style={{ color: colors.owe, marginTop: 8 }}>{error}</Text>}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  rowTitle: { fontSize: typeScale.subhead, fontWeight: '500', color: colors.ink },
  rowSub: { fontSize: typeScale.caption, color: colors.inkSoft, marginTop: 2 },
  badge: {
    backgroundColor: colors.ledgerSoft,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { fontSize: typeScale.caption, color: colors.inkSoft },
  form: { flexDirection: 'row', gap: 8, marginTop: 16 },
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
