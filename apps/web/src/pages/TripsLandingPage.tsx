import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Trip } from '../api';
import { AddTripModal } from '../components/AddTripModal';

const DAY_MS = 86_400_000;

/** A trip's start/end are date-only strings; treat them as plain calendar
 *  dates (anchored to UTC midnight) rather than a moment in the viewer's
 *  timezone, so "in 9 days" means 9 calendar days regardless of where the
 *  trip or the viewer is. */
function calendarDate(dateStr: string): Date {
  return new Date(dateStr.slice(0, 10) + 'T00:00:00Z');
}

function daysFromToday(dateStr: string): number {
  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((calendarDate(dateStr).getTime() - todayUTC) / DAY_MS);
}

function formatDateRange(startDate: string | null, endDate: string | null): string | null {
  if (!startDate && !endDate) return null;
  const fmt = (d: Date, withMonth: boolean) =>
    d.toLocaleDateString(undefined, withMonth ? { day: 'numeric', month: 'short', timeZone: 'UTC' } : { day: 'numeric', timeZone: 'UTC' });
  if (startDate && endDate) {
    const start = calendarDate(startDate);
    const end = calendarDate(endDate);
    const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
    return `${fmt(start, !sameMonth)} – ${fmt(end, true)}`;
  }
  return fmt(calendarDate((startDate ?? endDate)!), true);
}

/** A trip counts as "past" once its last day (end date, or start date if it
 *  has no end) is behind today — those move to the History tab instead of
 *  the main list. A trip with no dates at all can't be past, so it stays. */
function isPastTrip(trip: Trip): boolean {
  const lastDay = trip.endDate ?? trip.startDate;
  return lastDay != null && daysFromToday(lastDay) < 0;
}

/** A short, real-data status for a trip card: how soon it starts, or that
 *  it's underway. Past trips get no status. `sentence` completes "{name} __"
 *  for the hero line; `label` is the standalone badge text on the card. */
function tripStatus(trip: Trip): { label: string; sentence: string; active: boolean } | null {
  if (!trip.startDate) return null;
  const untilStart = daysFromToday(trip.startDate);
  const untilEnd = trip.endDate ? daysFromToday(trip.endDate) : untilStart;

  if (untilStart <= 0 && untilEnd >= 0) {
    return { label: 'Happening now', sentence: 'is happening now', active: true };
  }
  if (untilStart < 0) return null;
  if (untilStart === 0) return { label: 'Starts today', sentence: 'starts today', active: false };
  if (untilStart === 1) return { label: 'Starts tomorrow', sentence: 'starts tomorrow', active: false };
  return { label: `In ${untilStart} days`, sentence: `starts in ${untilStart} days`, active: false };
}

export function TripsLandingPage() {
  const navigate = useNavigate();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Trip | null>(null);
  const [view, setView] = useState<'trips' | 'history'>('trips');
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const handleDuplicate = async (trip: Trip) => {
    setDuplicatingId(trip.id);
    setActionError(null);
    try {
      await api.duplicateTrip(trip.id);
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to duplicate trip');
    } finally {
      setDuplicatingId(null);
    }
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
      <div className="main main-centered">
        <h1 className="page-title">Your trips</h1>
        <div className="trip-card-grid" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div className="trip-skeleton" key={i}>
              <div className="trip-skeleton-strip" />
              <div className="trip-skeleton-line" />
              <div className="trip-skeleton-line" />
            </div>
          ))}
        </div>
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

  // Surface the soonest trip that hasn't finished yet, so the page opens
  // with something the viewer didn't already know rather than a static label.
  const upcoming = trips
    .filter((t) => t.startDate && daysFromToday(t.endDate ?? t.startDate!) >= 0)
    .sort((a, b) => calendarDate(a.startDate!).getTime() - calendarDate(b.startDate!).getTime())[0];
  const upcomingStatus = upcoming ? tripStatus(upcoming) : null;

  const pastTrips = trips.filter(isPastTrip);
  const activeTrips = trips.filter((t) => !isPastTrip(t));
  const visibleTrips = view === 'history' ? pastTrips : activeTrips;

  return (
    <div className="main main-centered">
      <div className="trip-hero">
        <h1 className="page-title">Your trips</h1>
        {upcoming && upcomingStatus && (
          <p className="trip-hero-status">
            {upcoming.name} {upcomingStatus.sentence}.
          </p>
        )}
      </div>

      {actionError && (
        <p className="empty-state" style={{ color: 'var(--owe)', padding: '0 0 12px' }}>
          {actionError}
        </p>
      )}

      {trips.length === 0 ? (
        <div className="empty-landing">
          <p className="empty-state">You haven't planned a trip yet.</p>

          <button
            className="btn"
            onClick={() => setShowModal(true)}
          >
            + Add a trip
          </button>
        </div>
      ) : (
        <>
          <div className="tab-row no-print" style={{ margin: '0 auto 24px' }}>
            <button className={view === 'trips' ? 'active' : ''} onClick={() => setView('trips')}>
              Trips
            </button>
            <button className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}>
              History
            </button>
          </div>

          {visibleTrips.length === 0 && (
            <p className="empty-state">
              {view === 'history' ? 'No past trips yet.' : 'No upcoming trips.'}
            </p>
          )}

          <div className="trip-card-grid">
          {visibleTrips.map((trip) => {
            const dateRange = formatDateRange(trip.startDate, trip.endDate);
            const status = tripStatus(trip);
            return (
              <div key={trip.id} className="trip-card">
                <button
                  className="trip-card-body"
                  onClick={() => navigate(`/trips/${trip.id}`)}
                >
                  {trip.coverPhoto ? (
                    <img src={trip.coverPhoto} alt="" className="trip-card-strip" />
                  ) : (
                    <div className="trip-card-strip trip-card-strip-fallback" />
                  )}

                  <div className="trip-card-content">
                    <span className="trip-card-name">{trip.name}</span>

                    {dateRange && <span className="trip-card-dates">{dateRange}</span>}

                    {status && (
                      <span className={`trip-card-status${status.active ? ' active' : ''}`}>{status.label}</span>
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  className="trip-card-duplicate"
                  aria-label={`Duplicate ${trip.name}`}
                  title={`Duplicate ${trip.name}`}
                  disabled={duplicatingId === trip.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDuplicate(trip);
                  }}
                >
                  {duplicatingId === trip.id ? '…' : '⧉'}
                </button>

                <button
                  type="button"
                  className="trip-card-remove"
                  aria-label={`Delete ${trip.name}`}
                  title={`Delete ${trip.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(trip);
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}

          {view === 'trips' && (
            <button
              className="trip-card trip-card-add"
              onClick={() => setShowModal(true)}
            >
              + Add a trip
            </button>
          )}
          </div>
        </>
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