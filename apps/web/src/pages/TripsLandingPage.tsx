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
  const [confirmDelete, setConfirmDelete] = useState<Trip | null>(null);

  const load = useCallback(() => {
    setError(null);
    setLoading(true);

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

  const handleDelete = async () => {
    if (!confirmDelete) return;

    try {
      await api.deleteTrip(confirmDelete.id);
      setConfirmDelete(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete trip');
    }
  };

  if (loading) {
    return (
      <div className="main">
        <p className="empty-state">Loading trips…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="main">
        <p className="empty-state">
          Couldn't load trips: {error}
        </p>
      </div>
    );
  }

  return (
    <div className="main main-centered">
      <h1 className="page-title page-title-centered">
        Your trips
      </h1>

      {trips.length === 0 ? (
        <div className="empty-landing">
          <p className="empty-state">No trips yet.</p>

          <button
            className="btn"
            onClick={() => setShowModal(true)}
          >
            + Add a trip
          </button>
        </div>
      ) : (
        <div className="trip-card-grid">
          {trips.map((trip) => (
            <div key={trip.id} className="trip-card">
              <button
                className="trip-card-body"
                onClick={() => navigate(`/trips/${trip.id}`)}
              >
                {trip.coverPhoto && (
                  <img
                    src={trip.coverPhoto}
                    alt=""
                    className="trip-card-photo"
                  />
                )}

                <span className="trip-card-name">
                  {trip.name}
                </span>

                {(trip.startDate || trip.endDate) && (
                  <span className="trip-card-dates">
                    {trip.startDate?.slice(0, 10)}
                    {trip.endDate
                      ? ` – ${trip.endDate.slice(0, 10)}`
                      : ''}
                  </span>
                )}
              </button>

              <button
                className="trip-card-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(trip);
                }}
              >
                Delete
              </button>
            </div>
          ))}

          <button
            className="trip-card trip-card-add"
            onClick={() => setShowModal(true)}
          >
            + Add a trip
          </button>
        </div>
      )}

      {confirmDelete && (
        <div
          className="modal-backdrop"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <p>
              Delete "{confirmDelete.name}"? This can't be undone.
            </p>

            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                marginTop: 16,
              }}
            >
              <button
                className="btn btn-outline"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>

              <button
                className="btn"
                style={{
                  background: 'var(--owe)',
                  borderColor: 'var(--owe)',
                }}
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <AddTripModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}