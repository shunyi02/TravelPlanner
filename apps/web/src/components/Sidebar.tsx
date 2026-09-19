import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { api, type Trip } from '../api';
import { AddTripModal } from './AddTripModal';

export function Sidebar() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api
      .listTrips()
      .then(setTrips)
      .catch((err) => console.error('Failed to load trips', err))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreated = (tripId: string) => {
    setShowModal(false);
    load();
    navigate(`/trips/${tripId}`);
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
      <button className="btn" onClick={() => setShowModal(true)} style={{ marginTop: 16, width: '100%' }}>
        + Add a trip
      </button>
      {showModal && <AddTripModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}
    </aside>
  );
}
