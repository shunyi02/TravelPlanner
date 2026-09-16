import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type TripDetail as TripDetailType, type Expense } from '../api';
import { ItineraryTab } from '../components/ItineraryTab';
import { ExpensesTab } from '../components/ExpensesTab';
import { BalancesTab } from '../components/BalancesTab';

type Tab = 'itinerary' | 'expenses' | 'balances';

export function TripDetailPage() {
  const { tripId } = useParams<{ tripId: string }>();
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

  if (!tripId) return null;
  if (error) return <div className="main"><p className="empty-state">Couldn't load trip: {error}</p></div>;
  if (!trip) return <div className="main"><p className="empty-state">Loading…</p></div>;

  const memberNames = Object.fromEntries(trip.members.map((m) => [m.userId, m.user.name]));

  return (
    <div className="main">
      <Link to="/" className="back-link">&larr; Back to trips</Link>
      <h1 className="page-title">{trip.name}</h1>
      {(trip.startDate || trip.endDate) && (
        <p className="trip-dates">
          {trip.startDate?.slice(0, 10)} {trip.endDate ? `– ${trip.endDate.slice(0, 10)}` : ''}
        </p>
      )}

      <div className="tab-row">
        <button className={tab === 'itinerary' ? 'active' : ''} onClick={() => setTab('itinerary')}>
          Itinerary
        </button>
        <button className={tab === 'expenses' ? 'active' : ''} onClick={() => setTab('expenses')}>
          Expenses
        </button>
        <button className={tab === 'balances' ? 'active' : ''} onClick={() => setTab('balances')}>
          Balances
        </button>
      </div>

      {tab === 'itinerary' && <ItineraryTab tripId={tripId} trip={trip} places={trip.places} onChange={load} />}
      {tab === 'expenses' && (
        <ExpensesTab tripId={tripId} expenses={expenses} memberNames={memberNames} onChange={load} />
      )}
      {tab === 'balances' && <BalancesTab tripId={tripId} memberNames={memberNames} />}
    </div>
  );
}
