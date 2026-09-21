import { useState } from 'react';
import type { Place, TripDetail } from '../api';
import { api } from '../api';
import { AddItineraryItemModal } from './AddItineraryItemModal';
import { RouteMap, type RouteStop } from './RouteMap';
import { SuggestedStopsPanel } from './SuggestedStopsPanel';

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

/** Calendar-day difference between two "YYYY-MM-DD" keys (UTC-anchored, matching
 *  dayKeysFor's convention). */
function dayDelta(fromDay: string, toDay: string): number {
  const from = new Date(fromDay + 'T00:00:00Z').getTime();
  const to = new Date(toDay + 'T00:00:00Z').getTime();
  return Math.round((to - from) / 86_400_000);
}

/** Shift an ISO datetime by whole calendar days, keeping its time-of-day. */
function shiftDateByDays(iso: string, delta: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString();
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
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [dragPlace, setDragPlace] = useState<{ id: string; sourceDay?: string } | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [view, setView] = useState<'overview' | string>('overview');

  const handleSaveDates = async (e: React.FormEvent) => {
    e.preventDefault();
    setDateError(null);
    try {
      await api.updateTrip(tripId, {
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

  /** Move a place to a different day by shifting its date field(s). For a
   *  place already scheduled, `sourceDay` (the day-bucket it was dragged from)
   *  and the target day give a delta applied to every date field it has, so a
   *  multi-day hotel keeps its length of stay. An unscheduled place just gets
   *  the target day. */
  const handleMoveToDay = async (placeId: string, sourceDay: string | undefined, targetDay: string) => {
    const place = places.find((p) => p.id === placeId);
    if (!place || sourceDay === targetDay) return;
    setMoveError(null);
    try {
      if (place.type === 'HOTEL') {
        if (!place.checkIn) {
          await api.updatePlace(tripId, place.id, {
            checkIn: `${targetDay}T00:00:00.000Z`,
            checkOut: `${targetDay}T00:00:00.000Z`,
          });
        } else {
          const delta = dayDelta(sourceDay!, targetDay);
          await api.updatePlace(tripId, place.id, {
            checkIn: shiftDateByDays(place.checkIn, delta),
            checkOut: place.checkOut ? shiftDateByDays(place.checkOut, delta) : undefined,
          });
        }
      } else if (place.type === 'FLIGHT') {
        if (!place.departureTime) {
          await api.updatePlace(tripId, place.id, { departureTime: `${targetDay}T00:00:00.000Z` });
        } else {
          const delta = dayDelta(sourceDay!, targetDay);
          await api.updatePlace(tripId, place.id, {
            departureTime: shiftDateByDays(place.departureTime, delta),
            arrivalTime: place.arrivalTime ? shiftDateByDays(place.arrivalTime, delta) : undefined,
          });
        }
      } else {
        if (!place.visitDate) {
          await api.updatePlace(tripId, place.id, { visitDate: `${targetDay}T00:00:00.000Z` });
        } else {
          const delta = dayDelta(sourceDay!, targetDay);
          await api.updatePlace(tripId, place.id, { visitDate: shiftDateByDays(place.visitDate, delta) });
        }
      }
      onChange();
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : 'Could not move item to that day');
    }
  };

  const days = startDate && endDate ? daysBetween(startDate, endDate) : [];
  const currentDay = view !== 'overview' && days.includes(view) ? view : null;
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

  /** Located stops/hotels from `list`, in visit order for `day` (undefined = whole-trip
   *  order). Each stop is tagged with its own day bucket for map coloring — `day` when
   *  given (a single-day call site), else the place's own first day key ("" if unscheduled). */
  const toRouteStops = (list: Place[], day?: string): RouteStop[] =>
    list
      .filter((p): p is Place & { lat: number; lng: number } => p.lat != null && p.lng != null)
      .sort((a, b) => sortTimeForDay(a, day) - sortTimeForDay(b, day))
      .map((p, i) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, order: i + 1, day: day ?? dayKeysFor(p)[0] ?? '' }));

  /** The whole trip's located stops/hotels, in visit order, for the overview map
   *  when no trip dates are set yet (nothing is day-bucketed, so nothing counts
   *  as "unscheduled" either). */
  const routeStops: RouteStop[] = toRouteStops(places);

  /** Same, but for the day-bucketed overview map: excludes places sitting in the
   *  "Unscheduled" list, which has no day and so shouldn't plot on the map. */
  const unscheduledIds = new Set(unscheduled.map((p) => p.id));
  const scheduledRouteStops: RouteStop[] = toRouteStops(places.filter((p) => !unscheduledIds.has(p.id)));

  const renderRow = (place: Place, opts?: { day?: string; index?: number; draggable?: boolean }) => {
    const subtitle = placeSubtitle(place, opts?.day);
    const isTransitionDay =
      place.type === 'HOTEL' &&
      opts?.day &&
      (opts.day === place.checkIn?.slice(0, 10) || opts.day === place.checkOut?.slice(0, 10));
    return (
      <div
        className="ledger-row"
        key={place.id}
        draggable={opts?.draggable}
        onDragStart={() => setDragPlace({ id: place.id, sourceDay: opts?.day })}
        onDragEnd={() => setDragPlace(null)}
        style={opts?.draggable ? { cursor: 'grab', opacity: dragPlace?.id === place.id ? 0.5 : 1 } : undefined}
      >
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
        <div className="ledger-row-actions">
          <button type="button" className="text-btn" onClick={() => setEditingPlace(place)}>
            Edit
          </button>
          <button
            type="button"
            className="text-btn text-btn-danger"
            onClick={() => handleDelete(place)}
            disabled={deletingId === place.id}
          >
            {deletingId === place.id ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <form className="form-inline no-print" onSubmit={handleSaveDates} style={{ marginBottom: 24 }}>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <span>to</span>
        <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
        <button className="btn" type="submit">
          Save dates
        </button>
      </form>
      {dateError && <p style={{ color: 'var(--owe)', margin: '0 0 16px' }}>{dateError}</p>}
      {deleteError && <p style={{ color: 'var(--owe)', margin: '0 0 16px' }}>{deleteError}</p>}
      {moveError && <p style={{ color: 'var(--owe)', margin: '0 0 16px' }}>{moveError}</p>}

      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className="btn" onClick={() => setShowAddModal(true)}>
          + Add
        </button>
        <button className="btn btn-outline" onClick={() => window.print()}>
          Export PDF
        </button>
      </div>

      <SuggestedStopsPanel
        tripId={tripId}
        trip={trip}
        existingPlaceNames={places.map((p) => p.name)}
        onAdded={onChange}
      />

      {days.length === 0 ? (
        <>
          <RouteMap stops={routeStops} />
          {places.length === 0 ? (
            <p className="empty-state">No stops yet. Set trip dates above to plan day by day.</p>
          ) : (
            <div>{places.map((place, index) => renderRow(place, { index }))}</div>
          )}
        </>
      ) : (
        (() => {
          return (
            <>
              <div className="tab-row no-print" style={{ marginBottom: 16 }}>
                <button className={currentDay === null ? 'active' : ''} onClick={() => setView('overview')}>
                  Overview
                </button>
                {days.map((day) => (
                  <button key={day} className={currentDay === day ? 'active' : ''} onClick={() => setView(day)}>
                    {formatDay(day)}
                  </button>
                ))}
              </div>

              {currentDay === null ? (
                <>
                  <RouteMap stops={scheduledRouteStops} />
                  <div>
                    {days.map((day) => (
                      <div key={day} style={{ marginBottom: 20 }}>
                        <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600 }}>{formatDay(day)}</h3>
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverDay(day);
                          }}
                          onDragLeave={() => setDragOverDay((d) => (d === day ? null : d))}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOverDay(null);
                            if (dragPlace) handleMoveToDay(dragPlace.id, dragPlace.sourceDay, day);
                          }}
                          style={{
                            borderTop: '1px solid var(--rule)',
                            paddingTop: 4,
                            minHeight: 8,
                            background: dragOverDay === day ? 'var(--route-soft)' : undefined,
                          }}
                        >
                          {(byDay.get(day) ?? []).length === 0 ? (
                            <p className="empty-state" style={{ padding: '8px 0' }}>No stops planned.</p>
                          ) : (
                            byDay.get(day)!.map((place) => renderRow(place, { day, draggable: true }))
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
                          {unscheduled.map((place) => renderRow(place, { draggable: true }))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <RouteMap stops={toRouteStops(byDay.get(currentDay) ?? [], currentDay)} />
                  <div style={{ borderTop: '1px solid var(--rule)', paddingTop: 4 }}>
                    {(byDay.get(currentDay) ?? []).length === 0 ? (
                      <p className="empty-state" style={{ padding: '8px 0' }}>No stops planned.</p>
                    ) : (
                      byDay.get(currentDay)!.map((place) => renderRow(place, { day: currentDay }))
                    )}
                  </div>
                </>
              )}
            </>
          );
        })()
      )}

      {(showAddModal || editingPlace) && (
        <AddItineraryItemModal
          tripId={tripId}
          tripStartDate={startDate || undefined}
          tripEndDate={endDate || undefined}
          defaultDay={editingPlace ? undefined : currentDay ?? undefined}
          editPlace={editingPlace ?? undefined}
          onClose={() => {
            setShowAddModal(false);
            setEditingPlace(null);
          }}
          onSaved={() => {
            setShowAddModal(false);
            setEditingPlace(null);
            onChange();
          }}
        />
      )}
    </div>
  );
}