import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Trip } from '../api';
import { AddTripModal } from '../components/AddTripModal';

export function TripsLandingPage() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newTripName, setNewTripName] = useState('');

  const load = useCallback(() => {
    setError(null);
    api
      .listTrips()
      .then(setTrips)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const handleCreated = (tripId: string) => {
    setShowModal(false);
    load();
    navigate(`/trips/${tripId}`);
  };

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newTripName.trim();
    if (!name) return;

    api.createTrip({ name }).then((trip) => {
      setNewTripName('');
      handleCreated(trip.id);
    }).catch((err) => setError(err.message));
  };

  if (loading) return <div className="main"><p className="empty-state">Loading trips…</p></div>;
  if (error) return <div className="main"><p className="empty-state">Couldn't load trips: {error}</p></div>;

  return (
    <div className="main">
      <h1 className="page-title">Your trips</h1>

      {trips.length === 0 ? (
        <div className="empty-landing">
          <p className="empty-state">No trips yet.</p>
          {showModal ? (
            <form className="form-inline" onSubmit={handleCreate}>
              <input
                placeholder="Trip name"
                value={newTripName}
                onChange={(e) => setNewTripName(e.target.value)}
                autoFocus
              />
              <button className="btn" type="submit">Create</button>
            </form>
          ) : (
            <button className="btn" onClick={() => setShowModal(true)}>+ Add a trip</button>
          )}
        </div>
      ) : (
        <div className="trip-card-grid">
          {trips.map((trip) => (
            <button
              key={trip.id}
              className="trip-card"
              onClick={() => navigate(`/trips/${trip.id}`)}
            >
              <span className="trip-card-name">{trip.name}</span>
              {(trip.startDate || trip.endDate) && (
                <span className="trip-card-dates">
                  {trip.startDate?.slice(0, 10)}
                  {trip.endDate ? ` – ${trip.endDate.slice(0, 10)}` : ''}
                </span>
              )}
            </button>
          ))}
          <button className="trip-card trip-card-add" onClick={() => setShowModal(true)}>+ Add a trip</button>
        </div>
      )}

      {showModal && trips.length > 0 && (
        <form className="form-inline" onSubmit={handleCreate} style={{ marginTop: 16 }}>
          <input
            placeholder="Trip name"
            value={newTripName}
            onChange={(e) => setNewTripName(e.target.value)}
            autoFocus
          />
          <button className="btn" type="submit">Create</button>
        </form>
      )}
    </div>
  );
}