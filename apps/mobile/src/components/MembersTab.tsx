import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TripDetail } from '../api';
import { api } from '../api';
import { colors } from '../theme';

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
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.inviteMember(tripId, email.trim());
      setEmail('');
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send invite');
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
            <Text style={styles.rowSub}>{m.user.email}</Text>
          </View>
          {m.role === 'owner' && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>owner</Text>
            </View>
          )}
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
            <Pressable onPress={() => handleCancelInvite(invite.id)}>
              <Text style={[styles.textBtn, { color: colors.owe }]}>Cancel</Text>
            </Pressable>
          )}
        </View>
      ))}

      {isOwner && (
        <View style={styles.form}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Invite by email"
            placeholderTextColor={colors.inkSoft}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Pressable style={styles.button} onPress={handleInvite} disabled={saving}>
            <Text style={styles.buttonText}>{saving ? 'Inviting…' : 'Invite'}</Text>
          </Pressable>
        </View>
      )}
      {error && <Text style={{ color: colors.owe, marginTop: 8 }}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  rowTitle: { fontSize: 15, fontWeight: '500', color: colors.ink },
  rowSub: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  textBtn: { fontSize: 13, fontWeight: '500' },
  badge: {
    backgroundColor: colors.ledgerSoft,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, color: colors.inkSoft },
  form: { flexDirection: 'row', gap: 8, marginTop: 16 },
  input: {
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
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});
