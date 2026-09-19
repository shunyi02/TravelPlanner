import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Balance } from '@travel-planner/shared';
import { api, type TripDetail } from '../api';
import { useAuth } from '../authContext';
import { initials } from '../format';

/** Sidebar content shown while viewing a single trip: who's on it, an invite
 *  shortcut, and a way back — replacing the "all trips" list/add button,
 *  which don't apply once you're inside one trip. */
export function TripSidebarPanel({ tripId }: { tripId: string }) {
  const { currentUser } = useAuth();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api.getTrip(tripId).then(setTrip).catch((err) => console.error('Failed to load trip', err));
    api.getBalances(tripId).then(setBalances).catch((err) => console.error('Failed to load balances', err));
  };

  useEffect(load, [tripId]);

  if (!trip) {
    return (
      <aside className="sidebar">
        <Link to="/" className="back-link">&larr; Back to trips</Link>
        <p className="empty-state">Loading…</p>
      </aside>
    );
  }

  const isOwner = trip.members.find((m) => m.userId === currentUser?.id)?.role === 'owner';
  const myBalance = balances.find((b) => b.userId === currentUser?.id)?.amount ?? 0;

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.addManualMember(tripId, { name: name.trim(), email: email.trim() || undefined });
      setName('');
      setEmail('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add member');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await api.cancelInvite(tripId, inviteId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel invite');
    }
  };

  return (
    <aside className="sidebar">
      <Link to="/" className="back-link">&larr; Back to trips</Link>
      <p className="brand" style={{ marginBottom: 4 }}>{trip.name}</p>
      {(trip.startDate || trip.endDate) && (
        <p className="trip-dates" style={{ marginBottom: 12 }}>
          {trip.startDate?.slice(0, 10)}
          {trip.endDate ? ` – ${trip.endDate.slice(0, 10)}` : ''}
        </p>
      )}

      <p className="sidebar-balance" style={{ marginBottom: 20 }}>
        {Math.abs(myBalance) < 0.01 ? (
          'You’re all settled up'
        ) : (
          <>
            You {myBalance > 0 ? 'are owed' : 'owe'}{' '}
            <span className={myBalance > 0 ? 'amount owed-to-you' : 'amount you-owe'}>
              {Math.abs(myBalance).toFixed(2)}
            </span>
          </>
        )}
      </p>

      <p className="sidebar-section-label">Members</p>
      <ul className="sidebar-member-list">
        {trip.members.map((m) => (
          <li key={m.userId} className="sidebar-member-row">
            <span className={`sidebar-member-avatar${m.user.isPlaceholder ? ' sidebar-member-avatar-pending' : ''}`}>
              {initials(m.user.name)}
            </span>
            <span className="sidebar-member-name">{m.user.name}</span>
            {m.role === 'owner' && <span className="pending-badge">owner</span>}
            {m.user.isPlaceholder && <span className="pending-badge">not registered</span>}
          </li>
        ))}
        {trip.invites.map((invite) => (
          <li key={invite.id} className="sidebar-member-row">
            <span className="sidebar-member-avatar sidebar-member-avatar-pending">
              {invite.email[0]?.toUpperCase() ?? '?'}
            </span>
            <span className="sidebar-member-name">{invite.email}</span>
            {isOwner ? (
              <button
                type="button"
                className="text-btn text-btn-danger"
                onClick={() => handleCancelInvite(invite.id)}
              >
                Cancel
              </button>
            ) : (
              <span className="pending-badge">pending</span>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <form onSubmit={handleAddMember}>
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="email"
            placeholder="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn" type="submit" disabled={saving} style={{ width: '100%' }}>
            {saving ? 'Adding…' : '+ Add member'}
          </button>
        </form>
      )}
      {error && <p style={{ color: 'var(--owe)', fontSize: 13, marginTop: 8 }}>{error}</p>}
    </aside>
  );
}
