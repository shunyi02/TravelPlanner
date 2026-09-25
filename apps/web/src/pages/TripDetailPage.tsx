import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type TripDetail as TripDetailType, type Expense } from '../api';
import { useAuth } from '../authContext';
import { ItineraryTab } from '../components/ItineraryTab';
import { BookingsTab } from '../components/BookingsTab';
import { ExpensesTab } from '../components/ExpensesTab';
import { BalancesTab } from '../components/BalancesTab';
import { ReportTab } from '../components/ReportTab';
import { TripHero } from '../components/TripHero';
import { notifyTripChanged, onTripChanged } from '../tripEvents';

type Tab = 'itinerary' | 'bookings' | 'expenses' | 'balances' | 'report';

export function TripDetailPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const { currentUser } = useAuth();
  const [trip, setTrip] = useState<TripDetailType | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tab, setTab] = useState<Tab>('itinerary');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!tripId) return;
    setError(null);
    Promise.all([api.getTrip(tripId), api.listExpenses(tripId)])
      .then(([t, e]) => {
        setTrip(t);
        setExpenses(e);
      })
      .catch((err) => setError(err.message));
  }, [tripId]);

  useEffect(load, [load]);

  // The sidebar (TripSidebarPanel) fetches this same trip independently —
  // it's a sibling, not a parent/child — so pick up its mutations here too.
  useEffect(() => {
    if (!tripId) return;
    return onTripChanged(tripId, load);
  }, [tripId, load]);

  const handleChange = useCallback(() => {
    load();
    if (tripId) notifyTripChanged(tripId);
  }, [load, tripId]);

  if (!tripId) return null;
  if (error) {
    return (
      <div className="main">
        <p className="form-error spaced-below">Couldn't load this trip: {error}</p>
        <Link to="/" className="btn btn-outline">
          Back to your trips
        </Link>
      </div>
    );
  }
  if (!trip) {
    // Same shape as the loaded page (hero banner, tab row, content) so nothing jumps.
    return (
      <div className="main main-wide" aria-busy="true" aria-label="Loading trip">
        <div className="trip-skeleton-hero" />
        <div className="trip-skeleton-tabs" />
        <div className="trip-skeleton-body" />
      </div>
    );
  }

  const memberNames = Object.fromEntries(trip.members.map((m) => [m.userId, m.user.name]));

  return (
    <div className="main main-wide">
      <TripHero trip={trip} />

      <div className="tab-row no-print">
        <button className={tab === 'itinerary' ? 'active' : ''} onClick={() => setTab('itinerary')}>
          Itinerary
        </button>
        <button className={tab === 'bookings' ? 'active' : ''} onClick={() => setTab('bookings')}>
          Bookings
        </button>
        <button className={tab === 'expenses' ? 'active' : ''} onClick={() => setTab('expenses')}>
          Expenses
        </button>
        <button className={tab === 'balances' ? 'active' : ''} onClick={() => setTab('balances')}>
          Balances
        </button>
        <button className={tab === 'report' ? 'active' : ''} onClick={() => setTab('report')}>
          Report
        </button>
      </div>

      {tab === 'itinerary' && (
        <ItineraryTab
          tripId={tripId}
          trip={trip}
          places={trip.places}
          memberNames={memberNames}
          onChange={handleChange}
        />
      )}
      {tab === 'bookings' && <BookingsTab places={trip.places} memberNames={memberNames} />}
      {tab === 'expenses' && (
        <ExpensesTab
          tripId={tripId}
          expenses={expenses}
          memberNames={memberNames}
          currency={trip.currency}
          currentUserId={currentUser?.id}
          tripStartDate={trip.startDate}
          tripEndDate={trip.endDate}
          onChange={handleChange}
        />
      )}
      {tab === 'balances' && <BalancesTab tripId={tripId} memberNames={memberNames} currency={trip.currency} />}
      {tab === 'report' && (
        <ReportTab tripId={tripId} trip={trip} expenses={expenses} memberNames={memberNames} onChange={handleChange} />
      )}
    </div>
  );
}
