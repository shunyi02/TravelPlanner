import { useState } from 'react';
import type { Place, TripDetail } from '../api';
import { api } from '../api';
import { AddItineraryItemModal } from './AddItineraryItemModal';

function daysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const cur = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (cur <= last) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function formatDay(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

function placeSubtitle(place: Place): string | null {
  if (place.type === 'FLIGHT') {
    const from = place.departureAirport ?? '?';
    const to = place.arrivalAirport ?? '?';
    const dep = place.departureTime ? new Date(place.departureTime).toLocaleString() : '';
    const arr = place.arrivalTime ? new Date(place.arrivalTime).toLocaleString() : '';
    return `${from} → ${to}${dep ? ` · dep ${dep}` : ''}${arr ? ` · arr ${arr}` : ''}`;
  }
  if (place.type === 'HOTEL') {
    const ci = place.checkIn ? place.checkIn.slice(0, 10) : '';
    const co = place.checkOut ? place.checkOut.slice(0, 10) : '';
    return ci || co ? `${ci}${co ? ` – ${co}` : ''}` : null;
  }
  return place.notes ?? null;
}

export function ItineraryTab({
  tripId,
  trip,
  places,
  onChange,
}: {
  tripId: string;
  trip: TripDetail;
  places: Place[];
  onChange: () => void;
}) {
  const [startDate, setStartDate] = useState(trip.startDate?.slice(0, 10) ?? '');
  const [endDate, setEndDate] = useState(trip.endDate?.slice(0, 10) ?? '');
  const [dateError, setDateError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const handleSaveDates = async (e: React.FormEvent) => {
    e.preventDefault();
    setDateError(null);
    try {
      await api.updateTripDates(tripId, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      onChange();
    } catch (err) {
      setDateError(err instanceof Error ? err.message : 'Could not save dates');
    }
  };

  const days = startDate && endDate ? daysBetween(startDate, endDate) : [];
  const byDay = new Map<string, Place[]>();
  const unscheduled: Place[] = [];
  for (const p of places) {
    const key = p.visitDate?.slice(0, 10);
    if (key && days.includes(key)) {
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(p);
    } else {
      unscheduled.push(p);
    }
  }

  const renderRow = (place: Place, index?: number) => {
    const subtitle = placeSubtitle(place);
    return (
      <div className="ledger-row" key={place.id}>
        <div className="row-main">
          {index !== undefined && <span className="stop-index">{index + 1}</span>}
          <span className="row-title">
            {place.type === 'FLIGHT' ? '✈ ' : place.type === 'HOTEL' ? '🏨 ' : ''}
            {place.name}
          </span>
          {subtitle && <span className="row-sub">{subtitle}</span>}
        </div>
      </div>
    );
  };

  return (
    <div>
      <form className="form-inline" onSubmit={handleSaveDates} style={{ marginBottom: 24 }}>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <span>to</span>
        <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
        <button className="btn" type="submit">
          Save dates
        </button>
      </form>
      {dateError && <p style={{ color: 'var(--owe)', margin: '0 0 16px' }}>{dateError}</p>}

      <button className="btn" style={{ marginBottom: 20 }} onClick={() => setShowAddModal(true)}>
        + Add
      </button>

      {days.length === 0 ? (
        places.length === 0 ? (
          <p className="empty-state">No stops yet. Set trip dates above to plan day by day.</p>
        ) : (
          <div>{places.map((place, index) => renderRow(place, index))}</div>
        )
      ) : (
        <div>
          {days.map((day) => (
            <div key={day} style={{ marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600 }}>{formatDay(day)}</h3>
              <div style={{ borderTop: '1px solid var(--rule)', paddingTop: 4 }}>
                {(byDay.get(day) ?? []).length === 0 ? (
                  <p className="empty-state" style={{ padding: '8px 0' }}>No stops planned.</p>
                ) : (
                  byDay.get(day)!.map((place) => renderRow(place))
                )}
              </div>
            </div>
          ))}

          {unscheduled.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: 'var(--ink-soft)' }}>
                Unscheduled
              </h3>
              <div style={{ borderTop: '1px solid var(--rule)', paddingTop: 4 }}>
                {unscheduled.map((place) => renderRow(place))}
              </div>
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <AddItineraryItemModal
          tripId={tripId}
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            onChange();
          }}
        />
      )}
    </div>
  );
}