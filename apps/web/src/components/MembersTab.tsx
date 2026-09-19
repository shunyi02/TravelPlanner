import { useState } from 'react';
import type { TripDetail } from '../api';
import { api } from '../api';

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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div>
      <div>
        {trip.members.map((m) => (
          <div className="ledger-row" key={m.userId}>
            <div className="row-main">
              <span className="row-title">{m.user.name}</span>
              {!m.user.isPlaceholder && <span className="row-sub">{m.user.email}</span>}
            </div>
            {m.role === 'owner' && <span className="pending-badge">owner</span>}
            {m.user.isPlaceholder && <span className="pending-badge">not registered</span>}
          </div>
        ))}

        {trip.invites.map((invite) => (
          <div className="ledger-row" key={invite.id}>
            <div className="row-main">
              <span className="row-title">{invite.email}</span>
              <span className="pending-badge">pending</span>
            </div>
            {isOwner && (
              <button type="button" className="text-btn text-btn-danger" onClick={() => handleCancelInvite(invite.id)}>
                Cancel
              </button>
            )}
          </div>
        ))}
      </div>

      {isOwner && (
        <form className="form-inline" onSubmit={handleAddMember}>
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            type="email"
            placeholder="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Adding…' : 'Add member'}
          </button>
        </form>
      )}
      {error && <p style={{ color: 'var(--owe)' }}>{error}</p>}
    </div>
  );
}
