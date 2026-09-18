import { useState } from 'react';
import type { Place, TripDetail } from '../api';
import { api } from '../api';
import { AddItineraryItemModal } from './AddItineraryItemModal';

function daysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const cur = new Date(start + 'T00:00:00Z');
  const last = new Date(end + 'T00:00:00Z');
  while (cur <= last) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

function formatDay(iso: string) {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

function formatTime(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Which day-buckets a place belongs in. Hotels span every day from checkIn to checkOut
 *  inclusive; flights/stops occupy a single day. */
function dayKeysFor(place: Place): string[] {
  if (place.type === 'HOTEL') {
    if (!place.checkIn) return [];
    const ci = place.checkIn.slice(0, 10);
    const co = place.checkOut ? place.checkOut.slice(0, 10) : ci;
    const keys: string[] = [];
    const cur = new Date(ci + 'T00:00:00Z');
    const last = new Date(co + 'T00:00:00Z');
    while (cur <= last) {
      keys.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return keys;
  }
  if (place.type === 'FLIGHT') {
    return place.departureTime ? [place.departureTime.slice(0, 10)] : [];
  }
  return place.visitDate ? [place.visitDate.slice(0, 10)] : [];
}

/** For a hotel shown under a specific day, label what's happening that day
 *  (check-in / staying / check-out), including time if set. Undefined `day`
 *  means "not day-bucketed" (flat/unscheduled view) — falls back to date range. */
function hotelDayLabel(place: Place, day?: string): string | null {
  const ci = place.checkIn?.slice(0, 10);
  const co = place.checkOut?.slice(0, 10);
  if (!day || !ci) {
    return ci || co ? `${ci ?? ''}${co ? ` – ${co}` : ''}` : null;
  }
  if (day === ci && day === co) {
    return `Check-in ${formatTime(place.checkIn)} & check-out ${formatTime(place.checkOut)}`;
  }
  if (day === ci) return `Check-in ${formatTime(place.checkIn)}`;
  if (day === co) return `Check-out ${formatTime(place.checkOut)}`;
  return 'Staying';
}

function placeSubtitle(place: Place, day?: string): string | null {
  if (place.type === 'FLIGHT') {
    const from = place.departureAirport ?? '?';
    const to = place.arrivalAirport ?? '?';
    const dep = place.departureTime ? new Date(place.departureTime).toLocaleString() : '';
    const arr = place.arrivalTime ? new Date(place.arrivalTime).toLocaleString() : '';
    return `${from} → ${to}${dep ? ` · dep ${dep}` : ''}${arr ? ` · arr ${arr}` : ''}`;
  }
  if (place.type === 'HOTEL') {
    return hotelDayLabel(place, day);
  }
  const time = formatTime(place.visitDate);
  const coords = place.lat != null && place.lng != null ? `${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}` : null;
  const parts = [time, place.notes, coords].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Sort key for ordering rows within a single day bucket. Hotels use checkout
 *  time on their checkout day, check-in time otherwise (so "11am checkout" sits
 *  above "3pm check-in" on a same-day changeover). */
function sortTimeForDay(place: Place, day?: string): number {
  if (place.type === 'HOTEL') {
    const ci = place.checkIn;
    const co = place.checkOut;
    if (day && co && day === co.slice(0, 10) && (!ci || day !== ci.slice(0, 10))) {
      return new Date(co).getTime();
    }
    return ci ? new Date(ci).getTime() : 0;
  }
  if (place.type === 'FLIGHT') return place.departureTime ? new Date(place.departureTime).getTime() : 0;
  return place.visitDate ? new Date(place.visitDate).getTime() : 0;
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const handleDelete = async (place: Place) => {
    if (!confirm(`Remove "${place.name}" from the itinerary?`)) return;
    setDeleteError(null);
    setDeletingId(place.id);
    try {
      await api.deletePlace(tripId, place.id);
      onChange();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not remove item');
    } finally {
      setDeletingId(null);
    }
  };

  const days = startDate && endDate ? daysBetween(startDate, endDate) : [];
  const daySet = new Set(days);
  const byDay = new Map<string, Place[]>();
  const unscheduled: Place[] = [];
  for (const p of places) {
    const keys = dayKeysFor(p).filter((k) => daySet.has(k));
    if (keys.length > 0) {
      for (const key of keys) {
        if (!byDay.has(key)) byDay.set(key, []);
        byDay.get(key)!.push(p);
      }
    } else {
      unscheduled.push(p);
    }
  }
  for (const [day, dayPlaces] of byDay) {
    dayPlaces.sort((a, b) => sortTimeForDay(a, day) - sortTimeForDay(b, day));
  }

  const renderRow = (place: Place, opts?: { day?: string; index?: number }) => {
    const subtitle = placeSubtitle(place, opts?.day);
    const isTransitionDay =
      place.type === 'HOTEL' &&
      opts?.day &&
      (opts.day === place.checkIn?.slice(0, 10) || opts.day === place.checkOut?.slice(0, 10));
    return (
      <div className="ledger-row" key={place.id}>
        <div className="row-main">
          {opts?.index !== undefined && <span className="stop-index">{opts.index + 1}</span>}
          <span className="row-title">
            {place.type === 'FLIGHT' ? '✈ ' : place.type === 'HOTEL' ? '🏨 ' : ''}
            {place.name}
          </span>
          {subtitle && (
            <span
              className="row-sub"
              style={isTransitionDay ? { fontWeight: 600, color: 'var(--route)' } : undefined}
            >
              {subtitle}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => handleDelete(place)}
          disabled={deletingId === place.id}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--owe)',
            fontSize: 12,
            padding: '4px 8px',
            cursor: 'pointer',
          }}
        >
          {deletingId === place.id ? 'Removing…' : 'Remove'}
        </button>
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
      {deleteError && <p style={{ color: 'var(--owe)', margin: '0 0 16px' }}>{deleteError}</p>}

      <button className="btn" style={{ marginBottom: 20 }} onClick={() => setShowAddModal(true)}>
        + Add
      </button>

      {days.length === 0 ? (
        places.length === 0 ? (
          <p className="empty-state">No stops yet. Set trip dates above to plan day by day.</p>
        ) : (
          <div>{places.map((place, index) => renderRow(place, { index }))}</div>
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
                  byDay.get(day)!.map((place) => renderRow(place, { day }))
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
          tripStartDate={startDate || undefined}
          tripEndDate={endDate || undefined}
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