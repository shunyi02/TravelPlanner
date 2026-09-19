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
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div>
      <div>
        {trip.members.map((m) => (
          <div className="ledger-row" key={m.userId}>
            <div className="row-main">
              <span className="row-title">{m.user.name}</span>
              <span className="row-sub">{m.user.email}</span>
            </div>
            {m.role === 'owner' && <span className="pending-badge">owner</span>}
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
        <form className="form-inline" onSubmit={handleInvite}>
          <input
            type="email"
            placeholder="Invite by email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Inviting…' : 'Invite'}
          </button>
        </form>
      )}
      {error && <p style={{ color: 'var(--owe)' }}>{error}</p>}
    </div>
  );
}
