import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api, type Trip } from '../api';

export function Sidebar({ onLogout }: { onLogout: () => void }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [newTripName, setNewTripName] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    api
      .listTrips()
      .then(setTrips)
      .catch((err) => console.error('Failed to load trips', err))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTripName.trim()) return;
    await api.createTrip({ name: newTripName.trim() });
    setNewTripName('');
    load();
  };

  return (
    <aside className="sidebar">
      <p className="brand">Travel Planner</p>
      {loading ? (
        <p className="empty-state">Loading trips…</p>
      ) : trips.length === 0 ? (
        <p className="empty-state">No trips yet. Add your first one below.</p>
      ) : (
        <ul className="trip-list">
          {trips.map((trip) => (
            <li key={trip.id}>
              <NavLink to={`/trips/${trip.id}`} className={({ isActive }) => (isActive ? 'active' : '')}>
                {trip.name}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
      <form className="form-inline" onSubmit={handleCreate}>
        <input
          placeholder="New trip name"
          value={newTripName}
          onChange={(e) => setNewTripName(e.target.value)}
        />
        <button className="btn" type="submit">
          Add
        </button>
      </form>
      <button
        className="btn btn-outline"
        style={{ border: 'none', marginTop: 20, padding: '8px 0' }}
        onClick={() => {
          api.logout();
          onLogout();
        }}
      >
        Log out
      </button>
    </aside>
  );
}
