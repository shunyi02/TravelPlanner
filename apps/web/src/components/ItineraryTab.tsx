import { useEffect, useState } from 'react';
import type { Place, TripDetail } from '../api';
import { api } from '../api';
import { AddItineraryItemModal } from './AddItineraryItemModal';
import { DayWeather } from './DayWeather';
import { RouteMap, routeColorMap, type RouteStop } from './RouteMap';
import { SuggestedStopsPanel } from './SuggestedStopsPanel';
import type { DayForecast } from '../weather';
import { fetchWeather } from '../weather';
import { PLACE_ICONS } from '../placeIcons';
import { ConfirmDialog } from './ConfirmDialog';

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

/** "8/27" — the big numeral on each day card. */
function formatShortDate(day: string): string {
  const d = new Date(day + 'T00:00:00Z');
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function formatWeekday(day: string): string {
  return new Date(day + 'T00:00:00Z').toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
}

/** One-line heads-up for the selected day: rain (WMO codes 51+) wins, else a
 *  quick shape-of-the-day summary. */
function dayTip(dayPlaces: Place[], forecast?: DayForecast): { label: string; text: string } | null {
  if (forecast && forecast.code >= 51) {
    return { label: 'Rain tip', text: 'Showers forecast — keep an indoor backup for outdoor stops.' };
  }
  if (dayPlaces.length === 0) return { label: 'Free day', text: 'Nothing planned yet — add a stop or keep it slow.' };
  const first = dayPlaces[0];
  const time = first.type === 'HOTEL' ? null : formatTime(first.type === 'FLIGHT' ? first.departureTime : first.visitDate);
  const count = `${dayPlaces.length} stop${dayPlaces.length === 1 ? '' : 's'}`;
  return {
    label: 'Today',
    text: `${count} planned${time ? `, starting ${time} at ${first.name}` : ''}.`,
  };
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

/** Empty string means "everyone" (no assignees) — same convention as
 *  Place.assignments itself. Two stops are "for the same audience" only
 *  when this matches exactly. */
function assigneeSignature(place: Place): string {
  return [...assigneeSet(place)].sort().join(',');
}

function assigneeSet(place: Place): Set<string> {
  return new Set(place.assignments.map((a) => a.userId));
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
  memberNames,
  onChange,
}: {
  tripId: string;
  trip: TripDetail;
  places: Place[];
  memberNames: Record<string, string>;
  onChange: () => void;
}) {
  const memberIds = Object.keys(memberNames);
  const [startDate, setStartDate] = useState(trip.startDate?.slice(0, 10) ?? '');
  const [endDate, setEndDate] = useState(trip.endDate?.slice(0, 10) ?? '');
  const [dateError, setDateError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Place | null>(null);
  const [dragPlace, setDragPlace] = useState<{ id: string; sourceDay?: string } | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [view, setView] = useState<'overview' | string>('overview');
  const [weather, setWeather] = useState<Map<string, DayForecast>>(new Map());
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [assigningDay, setAssigningDay] = useState<string | null>(null);
  const [dayAssigneeIds, setDayAssigneeIds] = useState<string[]>([]);
  const [assigningBusy, setAssigningBusy] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  // Check-off state is a personal, on-the-road convenience, so it lives in
  // this browser only rather than on the shared trip.
  const doneKey = `itinerary-done:${tripId}`;
  const [doneIds, setDoneIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(doneKey) ?? '[]'));
    } catch {
      return new Set();
    }
  });

  const toggleDone = (id: string) => {
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(doneKey, JSON.stringify([...next]));
      } catch {
        // Storage blocked (private mode) — keep the in-memory state.
      }
      return next;
    });
  };

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
    setConfirmRemove(null);
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

  const openAssignDay = (day: string) => {
    setAssigningDay(day);
    setDayAssigneeIds([]);
    setAssignError(null);
  };

  /** Items on `day` not yet tied to a specific sub-group — what "Split this
   *  day" bulk-assigns. Already-assigned items are left alone, so bulk-
   *  assigning one group's newly-added stops never clobbers another group's
   *  stops already tagged for the same day. */
  const unassignedOnDay = (day: string) =>
    places.filter((p) => dayKeysFor(p).includes(day) && p.assignments.length === 0);

  /** Bulk-assigns every not-yet-assigned item scheduled on `assigningDay` to
   *  the chosen members — e.g. "day 3: 8 people go to Macao" without tagging
   *  each item one by one. Add the day's items for one group, split the day
   *  (tags all of them), then add the next group's items and split again. */
  const handleAssignDay = async () => {
    if (!assigningDay) return;
    const items = unassignedOnDay(assigningDay);
    if (items.length === 0) {
      setAssigningDay(null);
      return;
    }
    setAssigningBusy(true);
    setAssignError(null);
    try {
      await Promise.all(items.map((p) => api.updatePlace(tripId, p.id, { assigneeIds: dayAssigneeIds })));
      setAssigningDay(null);
      onChange();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Could not assign this day');
    } finally {
      setAssigningBusy(false);
    }
  };

  const days = startDate && endDate ? daysBetween(startDate, endDate) : [];

  useEffect(() => {
    if (trip.destinationLat == null || trip.destinationLng == null || days.length === 0) {
      setWeather(new Map());
      return;
    }
    let cancelled = false;
    fetchWeather(trip.destinationLat, trip.destinationLng, days[0], days[days.length - 1]).then((result) => {
      if (!cancelled) setWeather(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.destinationLat, trip.destinationLng, startDate, endDate]);
  const currentDay = view !== 'overview' && days.includes(view) ? view : null;
  // A place with no assignments is for everyone; otherwise only shown to (or
  // filtered to) the members it's assigned to.
  const visiblePlaces =
    assigneeFilter === 'all'
      ? places
      : places.filter((p) => p.assignments.length === 0 || p.assignments.some((a) => a.userId === assigneeFilter));
  const daySet = new Set(days);
  const byDay = new Map<string, Place[]>();
  const unscheduled: Place[] = [];
  for (const p of visiblePlaces) {
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

  /** Located stops/hotels from `list`, bucketed by day — `day` when given (a
   *  single-day call site), else each place's own first day key ("" if
   *  unscheduled). With `splitByAssignee` (the single-day map/list only —
   *  the overview stays one-color-per-day, or it gets noisy fast), a day
   *  with 2+ distinct assignee sets becomes several sub-group lines instead
   *  of one. A stop sits on a sub-group's line whenever that sub-group's
   *  members are all included in the stop's own assignees (an unassigned
   *  "everyone" stop is a superset of everything, so it sits on all of
   *  them) — so B and C's own stops never link to each other, but a later
   *  stop covering both B and C links back to each of their lines, showing
   *  the group reconverging rather than just two lines ending nearby. */
  const toRouteStops = (list: Place[], day?: string, splitByAssignee = true): RouteStop[] => {
    const located = list.filter((p): p is Place & { lat: number; lng: number } => p.lat != null && p.lng != null);

    const byBucket = new Map<string, typeof located>();
    for (const p of located) {
      const d = day ?? dayKeysFor(p)[0] ?? '';
      if (!byBucket.has(d)) byBucket.set(d, []);
      byBucket.get(d)!.push(p);
    }

    const result: RouteStop[] = [];
    for (const [d, bucket] of byBucket) {
      const sorted = [...bucket].sort((a, b) => sortTimeForDay(a, day) - sortTimeForDay(b, day));
      const signatures = splitByAssignee ? [...new Set(sorted.map(assigneeSignature).filter(Boolean))] : [];
      const isSplit = signatures.length >= 2;

      // Counts per line, not globally: a stop is "1" if it's the first stop
      // on ITS OWN line, even if another sub-group already visited their own
      // first stop earlier that day. A stop shared by several lines (a
      // reconvene point) advances every line it's on and shows the furthest
      // of them — "stop 2 for whichever line took longest to get here."
      const lineCounters = new Map<string, number>();

      sorted.forEach((p) => {
        const set = assigneeSet(p);
        const signature = assigneeSignature(p);
        const shared = isSplit && set.size === 0;
        const lineGroups = !isSplit
          ? [d]
          : shared
            ? signatures.map((s) => `${d}#${s}`)
            : signatures.filter((s) => s.split(',').every((id) => set.has(id))).map((s) => `${d}#${s}`);

        let order = 0;
        for (const lg of lineGroups) {
          const next = (lineCounters.get(lg) ?? 0) + 1;
          lineCounters.set(lg, next);
          order = Math.max(order, next);
        }

        result.push({
          id: p.id,
          name: p.name,
          lat: p.lat,
          lng: p.lng,
          order,
          colorGroup: isSplit ? (shared ? '' : `${d}#${signature}`) : d,
          lineGroups,
        });
      });
    }
    return result;
  };

  /** The whole trip's located stops/hotels, in visit order, for the overview map
   *  when no trip dates are set yet (nothing is day-bucketed, so nothing counts
   *  as "unscheduled" either). Kept to one color per day — sub-group detail is
   *  reserved for a specific day's own tab, or the overview gets noisy fast. */
  const routeStops: RouteStop[] = toRouteStops(visiblePlaces, undefined, false);

  /** Same, but for the day-bucketed overview map: excludes places sitting in the
   *  "Unscheduled" list, which has no day and so shouldn't plot on the map. */
  const unscheduledIds = new Set(unscheduled.map((p) => p.id));
  const scheduledRouteStops: RouteStop[] = toRouteStops(
    visiblePlaces.filter((p) => !unscheduledIds.has(p.id)),
    undefined,
    false,
  );

  // Bucketing (and so coloring) only depends on each place's own day, not on
  // which other days are present, so computing this once off the whole list
  // gives every overview row the same color its pin gets on the overview map.
  const overviewRouteStops = toRouteStops(visiblePlaces, undefined, false);
  const overviewColors = routeColorMap(overviewRouteStops);
  const overviewColorGroupByPlaceId = new Map(overviewRouteStops.map((s) => [s.id, s.colorGroup]));

  // The single day tab's own sub-group-aware colors, only computed for
  // whichever day is currently open.
  const dayRouteStops = currentDay ? toRouteStops(byDay.get(currentDay) ?? [], currentDay) : [];
  const dayColors = routeColorMap(dayRouteStops);
  const dayColorGroupByPlaceId = new Map(dayRouteStops.map((s) => [s.id, s.colorGroup]));

  const renderRow = (place: Place, opts?: { day?: string; index?: number; draggable?: boolean }) => {
    const BookingIcon = PLACE_ICONS[place.type];
    const subtitle = placeSubtitle(place, opts?.day);
    const isTransitionDay =
      place.type === 'HOTEL' &&
      opts?.day &&
      (opts.day === place.checkIn?.slice(0, 10) || opts.day === place.checkOut?.slice(0, 10));
    // The single-day tab shows sub-group-aware colors; everywhere else
    // (overview, unscheduled, the flat no-dates list) stays one-per-day.
    const onCurrentDayTab = currentDay !== null && opts?.day === currentDay;
    const colorGroupByPlaceId = onCurrentDayTab ? dayColorGroupByPlaceId : overviewColorGroupByPlaceId;
    const routeColors = onCurrentDayTab ? dayColors : overviewColors;
    const isStop = place.type === 'STOP';
    // Flights and hotels are pinned to their booked times, so only stops move between days.
    const draggable = isStop && opts?.draggable;
    return (
      <div
        className="ledger-row"
        key={place.id}
        draggable={draggable}
        onDragStart={() => setDragPlace({ id: place.id, sourceDay: opts?.day })}
        onDragEnd={() => setDragPlace(null)}
        style={draggable ? { cursor: 'grab', opacity: dragPlace?.id === place.id ? 0.5 : 1 } : undefined}
      >
        <div className={`row-main${!isStop ? ' is-booking' : doneIds.has(place.id) ? ' is-done' : ''}`}>
          {/* Only stops get checked off; flights and hotels are fixed bookings.
              The spacer keeps their titles aligned with the stops'. */}
          {isStop ? (
            <button
              type="button"
              className="stop-check no-print"
              aria-pressed={doneIds.has(place.id)}
              aria-label={doneIds.has(place.id) ? `Mark ${place.name} not done` : `Mark ${place.name} done`}
              onClick={() => toggleDone(place.id)}
            >
              {doneIds.has(place.id) ? '✓' : ''}
            </button>
          ) : (
            <span className="stop-check-spacer no-print" aria-hidden="true" />
          )}
          {opts?.index !== undefined && <span className="stop-index">{opts.index + 1}</span>}
          {colorGroupByPlaceId.has(place.id) && (
            <span
              className="route-color-dot"
              style={{ background: routeColors.get(colorGroupByPlaceId.get(place.id)!) }}
              title="Matches this stop's pin on the map"
            />
          )}
          <span className="row-title">
            {place.type !== 'STOP' && <BookingIcon className="icon-inline" size={15} aria-label={place.type === 'FLIGHT' ? 'Flight' : 'Hotel'} />}{' '}
            {place.name}
          </span>
          {place.assignments.length > 0 && (
            <span className="category-badge" title="Only for these members">
              {place.assignments.map((a) => memberNames[a.userId] ?? a.userId).join(', ')}
            </span>
          )}
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
            onClick={() => setConfirmRemove(place)}
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
      <form className="form-inline no-print itin-dates-form" onSubmit={handleSaveDates}>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <span>to</span>
        <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
        <button className="btn" type="submit">
          Save dates
        </button>
      </form>
      {dateError && <p className="form-error spaced-below">{dateError}</p>}
      {deleteError && <p className="form-error spaced-below">{deleteError}</p>}
      {moveError && <p className="form-error spaced-below">{moveError}</p>}

      <div className="no-print btn-row">
        <button className="btn" onClick={() => setShowAddModal(true)}>
          + Add
        </button>
        <button className="btn btn-outline" onClick={() => window.print()}>
          Export PDF
        </button>
      </div>
      {memberIds.length > 1 && (
        <div className="filter-row no-print section-gap">
          <span className="filter-row-label">Viewing</span>
          <div className="filter-select-wrap">
            <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
              <option value="all">Everyone's plans</option>
              {memberIds.map((id) => (
                <option key={id} value={id}>{memberNames[id] ?? id}'s plans</option>
              ))}
            </select>
          </div>
        </div>
      )}

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
          ) : visiblePlaces.length === 0 ? (
            <p className="empty-state">No stops for this filter.</p>
          ) : (
            <div className="card">{visiblePlaces.map((place, index) => renderRow(place, { index }))}</div>
          )}
        </>
      ) : (
        (() => {
          return (
            <>
              <div className="itin-route-head">
                <h2 className="itin-route-title">{currentDay ? 'Today’s route' : 'All days'}</h2>
                {currentDay && (
                  <span className="itin-route-meta">
                    DAY {days.indexOf(currentDay) + 1} / {formatWeekday(currentDay).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="day-cards no-print">
                <button
                  type="button"
                  className={`day-card${currentDay === null ? ' active' : ''}`}
                  onClick={() => setView('overview')}
                >
                  <span className="day-card-date">All</span>
                  <span className="day-card-sub">Overview · {days.length} days</span>
                </button>
                {days.map((day, i) => (
                  <button
                    key={day}
                    type="button"
                    className={`day-card${currentDay === day ? ' active' : ''}`}
                    onClick={() => setView(day)}
                  >
                    <span className="day-card-date">
                      {formatShortDate(day)} <DayWeather forecast={weather.get(day)} compact />
                    </span>
                    <span className="day-card-sub">
                      {formatWeekday(day)} · Day {i + 1}
                    </span>
                  </button>
                ))}
              </div>
              {currentDay &&
                (() => {
                  const tip = dayTip(byDay.get(currentDay) ?? [], weather.get(currentDay));
                  return (
                    tip && (
                      <div className="itin-tip">
                        <strong>{tip.label}:</strong> {tip.text}
                      </div>
                    )
                  );
                })()}

              {currentDay === null ? (
                <>
                  <RouteMap stops={scheduledRouteStops} />
                  <div>
                    {days.map((day) => (
                      <div key={day} className="section-gap">
                        <div className="day-heading-row">
                          <h3 className="day-heading">
                            {formatDay(day)} <DayWeather forecast={weather.get(day)} />
                          </h3>
                          {memberIds.length > 1 && unassignedOnDay(day).length > 0 && (
                            <button type="button" className="text-btn no-print" onClick={() => openAssignDay(day)}>
                              Split this day…
                            </button>
                          )}
                        </div>
                        <div
                          className="card"
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
                            minHeight: 8,
                            background: dragOverDay === day ? 'var(--route-soft)' : undefined,
                          }}
                        >
                          {(byDay.get(day) ?? []).length === 0 ? (
                            <p className="empty-state empty-state-compact">No stops planned.</p>
                          ) : (
                            byDay.get(day)!.map((place) => renderRow(place, { day, draggable: true }))
                          )}
                        </div>
                      </div>
                    ))}

                    {unscheduled.length > 0 && (
                      <div className="section-gap">
                        <h3 className="day-heading day-heading-muted">
                          Unscheduled
                        </h3>
                        <div className="card">
                          {unscheduled.map((place) => renderRow(place, { draggable: true }))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="day-heading-row">
                    <h3 className="day-heading">
                      {formatDay(currentDay)} <DayWeather forecast={weather.get(currentDay)} />
                    </h3>
                    {memberIds.length > 1 && unassignedOnDay(currentDay).length > 0 && (
                      <button type="button" className="text-btn no-print" onClick={() => openAssignDay(currentDay)}>
                        Split this day…
                      </button>
                    )}
                  </div>
                  <RouteMap stops={toRouteStops(byDay.get(currentDay) ?? [], currentDay)} />
                  <div className="card">
                    {(byDay.get(currentDay) ?? []).length === 0 ? (
                      <p className="empty-state empty-state-compact">No stops planned.</p>
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
          memberIds={memberIds}
          memberNames={memberNames}
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

      {assigningDay && (
        <div className="modal-backdrop" onClick={() => setAssigningDay(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Split {formatDay(assigningDay)}</h2>
            <p className="field-hint">
              Assigns {unassignedOnDay(assigningDay).length} not-yet-assigned item
              {unassignedOnDay(assigningDay).length === 1 ? '' : 's'} on this day to whoever you pick below.
              Items already assigned to a group are left alone.
            </p>
            <div className="check-group">
              {memberIds.map((id) => (
                <label key={id} className="check-label">
                  <input
                    type="checkbox"
                    checked={dayAssigneeIds.includes(id)}
                    onChange={() =>
                      setDayAssigneeIds((prev) =>
                        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                      )
                    }
                  />
                  {memberNames[id] ?? id}
                </label>
              ))}
            </div>
            {assignError && <p className="form-error spaced-above">{assignError}</p>}
            <div className="form-actions">
              <button type="button" className="btn btn-outline" onClick={() => setAssigningDay(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                disabled={assigningBusy || dayAssigneeIds.length === 0}
                onClick={handleAssignDay}
              >
                {assigningBusy ? 'Applying…' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmRemove && (
        <ConfirmDialog
          message={`Remove "${confirmRemove.name}" from the itinerary?`}
          confirmLabel="Remove"
          onConfirm={() => handleDelete(confirmRemove)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}