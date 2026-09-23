import { useState } from 'react';
import { api, type Place, type PlaceType } from '../api';
import { AirportField } from './AirportField';
import { LocationSearchField } from './LocationSearchField';

type FlightTripType = 'ONE_WAY' | 'ROUND_TRIP';

const PLACE_TYPE_INFO: Record<PlaceType, { label: string; icon: string; hint: string }> = {
  STOP: { label: 'Stop', icon: '📍', hint: 'A place to visit — attraction, restaurant, etc.' },
  HOTEL: { label: 'Hotel', icon: '🏨', hint: 'Where you’re staying, with check-in/out' },
  FLIGHT: { label: 'Flight', icon: '✈️', hint: 'A flight leg, one-way or round trip' },
};

/** Name for a flight the user left unnamed, e.g. "SIN → NRT". */
function flightLabel(from: string, to: string): string {
  return from || to ? `${from || '?'} → ${to || '?'}` : 'Flight';
}

/** "YYYY-MM-DD" + hour/minute -> a datetime-local value on that day. */
function dayAt(day: string, hour: number, minute = 0): string {
  return `${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** The day after `day` ("YYYY-MM-DD"), for a hotel's default check-out. */
function nextDay(day: string): string {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** ISO datetime -> "YYYY-MM-DDTHH:mm" in local time, for a datetime-local input's value. */
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AddItineraryItemModal({
  tripId,
  tripStartDate,
  tripEndDate,
  defaultDay,
  editPlace,
  memberIds,
  memberNames,
  onClose,
  onSaved,
}: {
  tripId: string;
  tripStartDate?: string;
  tripEndDate?: string;
  /** The day tab the modal was opened from (create flow only) — prefills
   *  each type's date field(s) to that day instead of leaving them blank. */
  defaultDay?: string;
  /** When set, the modal edits this existing place instead of creating a new one. */
  editPlace?: Place;
  /** Trip members, for the "who's this for" picker — lets a large group split
   *  its itinerary across sub-groups instead of everyone seeing everything. */
  memberIds: string[];
  memberNames: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<PlaceType | null>(editPlace?.type ?? null);
  const [name, setName] = useState(editPlace?.name ?? '');
  const [visitDate, setVisitDate] = useState(
    editPlace?.visitDate ? toDatetimeLocal(editPlace.visitDate) : defaultDay ? dayAt(defaultDay, 12) : '',
  );
  const [notes, setNotes] = useState(editPlace?.notes ?? '');

  // location search (STOP and HOTEL — flights aren't geocoded, just airport codes)
  const [locationQuery, setLocationQuery] = useState(
    editPlace?.type === 'STOP' || editPlace?.type === 'HOTEL' ? editPlace.name : '',
  );
  const [lat, setLat] = useState<number | undefined>(editPlace?.lat ?? undefined);
  const [lng, setLng] = useState<number | undefined>(editPlace?.lng ?? undefined);

  // flight (outbound)
  const [tripType, setTripType] = useState<FlightTripType>('ONE_WAY');
  const [departureTime, setDepartureTime] = useState(
    editPlace?.departureTime ? toDatetimeLocal(editPlace.departureTime) : defaultDay ? dayAt(defaultDay, 9) : '',
  );
  const [arrivalTime, setArrivalTime] = useState(
    editPlace?.arrivalTime ? toDatetimeLocal(editPlace.arrivalTime) : defaultDay ? dayAt(defaultDay, 12) : '',
  );
  const [departureAirport, setDepartureAirport] = useState(editPlace?.departureAirport ?? '');
  const [arrivalAirport, setArrivalAirport] = useState(editPlace?.arrivalAirport ?? '');

  // flight (return leg, round trip only — create flow only, N/A when editing a single leg)
  const [returnDepartureTime, setReturnDepartureTime] = useState('');
  const [returnArrivalTime, setReturnArrivalTime] = useState('');

  const [checkIn, setCheckIn] = useState(
    editPlace?.checkIn ? toDatetimeLocal(editPlace.checkIn) : defaultDay ? dayAt(defaultDay, 15) : '',
  );
  const [checkOut, setCheckOut] = useState(
    editPlace?.checkOut ? toDatetimeLocal(editPlace.checkOut) : defaultDay ? dayAt(nextDay(defaultDay), 11) : '',
  );
  const [assigneeIds, setAssigneeIds] = useState<string[]>(editPlace?.assignments.map((a) => a.userId) ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEveryone = assigneeIds.length === 0;

  // datetime-local needs "YYYY-MM-DDTHH:mm" bounds, not just a date
  const dtMin = tripStartDate ? `${tripStartDate}T00:00` : undefined;
  const dtMax = tripEndDate ? `${tripEndDate}T23:59` : undefined;

  /** Switch the type being edited/added. Clears fields specific to the previous type. */
  const changeType = (next: PlaceType) => {
    setType(next);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    // Flights name themselves from their airports; stops and hotels need a place.
    if (!type || (type !== 'FLIGHT' && !name.trim())) return;
    setSaving(true);
    setError(null);
    try {
      if (type === 'FLIGHT') {
        const flightData = {
          type,
          name: name.trim() || flightLabel(departureAirport, arrivalAirport),
          departureTime: departureTime || undefined,
          arrivalTime: arrivalTime || undefined,
          departureAirport: departureAirport || undefined,
          arrivalAirport: arrivalAirport || undefined,
          assigneeIds,
        };
        if (editPlace) {
          await api.updatePlace(tripId, editPlace.id, flightData);
        } else {
          await api.addPlace(tripId, flightData);
          if (tripType === 'ROUND_TRIP') {
            await api.addPlace(tripId, {
              type,
              name: name.trim() ? `${name.trim()} (return)` : flightLabel(arrivalAirport, departureAirport),
              departureTime: returnDepartureTime || undefined,
              arrivalTime: returnArrivalTime || undefined,
              // swapped: return leg goes arrival -> departure
              departureAirport: arrivalAirport || undefined,
              arrivalAirport: departureAirport || undefined,
              assigneeIds,
            });
          }
        }
      } else {
        const data = {
          type,
          name: name.trim(),
          visitDate: visitDate || undefined,
          ...((type === 'STOP' || type === 'HOTEL') && { lat, lng }),
          ...(type === 'STOP' && { notes: notes.trim() || undefined }),
          ...(type === 'HOTEL' && {
            checkIn: checkIn || undefined,
            checkOut: checkOut || undefined,
          }),
          assigneeIds,
        };
        if (editPlace) {
          await api.updatePlace(tripId, editPlace.id, data);
        } else {
          await api.addPlace(tripId, data);
        }
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${editPlace ? 'save' : 'add'} item`);
    } finally {
      setSaving(false);
    }
  };

  if (!type) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2 className="page-title" style={{ fontSize: 20 }}>Add to itinerary</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            {(['STOP', 'HOTEL', 'FLIGHT'] as PlaceType[]).map((t) => {
              const info = PLACE_TYPE_INFO[t];
              return (
                <button
                  key={t}
                  type="button"
                  className="place-type-option"
                  onClick={() => setType(t)}
                >
                  <span className="place-type-option-icon">{info.icon}</span>
                  <span>
                    <span className="place-type-option-label">{info.label}</span>
                    <span className="place-type-option-hint">{info.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="page-title" style={{ fontSize: 20 }}>
          {PLACE_TYPE_INFO[type].icon} {editPlace ? 'Edit' : 'Add'} {PLACE_TYPE_INFO[type].label.toLowerCase()}
        </h2>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {(['STOP', 'HOTEL', 'FLIGHT'] as PlaceType[]).map((t) => (
            <button
              key={t}
              type="button"
              className={type === t ? 'btn' : 'btn btn-outline'}
              onClick={() => changeType(t)}
              style={{ padding: '4px 12px', fontSize: 12 }}
            >
              {PLACE_TYPE_INFO[t].icon} {PLACE_TYPE_INFO[t].label}
            </button>
          ))}
        </div>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          {type === 'STOP' || type === 'HOTEL' ? (
            <LocationSearchField
              query={locationQuery}
              onQueryChange={(q) => {
                setLocationQuery(q);
                setName(q);
                setLat(undefined);
                setLng(undefined);
              }}
              onPick={(result) => {
                setName(result.name);
                setLat(result.lat);
                setLng(result.lng);
                setLocationQuery(result.displayName);
              }}
              lat={lat}
              lng={lng}
              autoFocus
            />
          ) : (
            <input
              placeholder="Flight number or airline (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          )}

          {type === 'STOP' && (
            <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              Visit time (optional)
              <input
                type="datetime-local"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                min={dtMin}
                max={dtMax}
                style={{ display: 'block', marginTop: 4 }}
              />
            </label>
          )}

          {type === 'STOP' && (
            <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              Notes (optional)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                style={{ display: 'block', marginTop: 4, width: '100%', resize: 'vertical' }}
              />
            </label>
          )}

          {type === 'FLIGHT' && (
            <>
              {!editPlace && (
                <div style={{ display: 'flex', gap: 16 }}>
                  <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="radio"
                      name="tripType"
                      checked={tripType === 'ONE_WAY'}
                      onChange={() => setTripType('ONE_WAY')}
                    />
                    One way
                  </label>
                  <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="radio"
                      name="tripType"
                      checked={tripType === 'ROUND_TRIP'}
                      onChange={() => setTripType('ROUND_TRIP')}
                    />
                    Round trip
                  </label>
                </div>
              )}

              <AirportField placeholder="Departure airport" value={departureAirport} onChange={setDepartureAirport} />
              <AirportField placeholder="Arrival airport" value={arrivalAirport} onChange={setArrivalAirport} />

              <div className="flight-leg">
                <p className="flight-leg-title">
                  ✈️ {tripType === 'ROUND_TRIP' ? 'Outbound' : 'Flight'}
                  {(departureAirport || arrivalAirport) && (
                    <span className="flight-leg-route"> · {departureAirport || '?'} → {arrivalAirport || '?'}</span>
                  )}
                </p>
                <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                  Departure
                  <input
                    type="datetime-local"
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    min={dtMin}
                    max={dtMax}
                    style={{ display: 'block', marginTop: 4 }}
                  />
                </label>
                <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                  Arrival
                  <input
                    type="datetime-local"
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value)}
                    min={dtMin}
                    max={dtMax}
                    style={{ display: 'block', marginTop: 4 }}
                  />
                </label>
              </div>

              {tripType === 'ROUND_TRIP' && (
                <div className="flight-leg">
                  <p className="flight-leg-title">
                    ✈️ Return
                    <span className="flight-leg-route"> · {arrivalAirport || '?'} → {departureAirport || '?'}</span>
                  </p>
                  <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                    Departure
                    <input
                      type="datetime-local"
                      value={returnDepartureTime}
                      onChange={(e) => setReturnDepartureTime(e.target.value)}
                      min={dtMin}
                      max={dtMax}
                      style={{ display: 'block', marginTop: 4 }}
                    />
                  </label>
                  <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                    Arrival
                    <input
                      type="datetime-local"
                      value={returnArrivalTime}
                      onChange={(e) => setReturnArrivalTime(e.target.value)}
                      min={dtMin}
                      max={dtMax}
                      style={{ display: 'block', marginTop: 4 }}
                    />
                  </label>
                </div>
              )}
            </>
          )}

          {type === 'HOTEL' && (
            <>
              <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                Check-in
                <input
                  type="datetime-local"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  min={dtMin}
                  max={dtMax}
                  style={{ display: 'block', marginTop: 4 }}
                />
              </label>
              <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                Check-out
                <input
                  type="datetime-local"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  min={dtMin}
                  max={dtMax}
                  style={{ display: 'block', marginTop: 4 }}
                />
              </label>
            </>
          )}

          {memberIds.length > 1 && (
            <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              Who's this for
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" checked={isEveryone} onChange={() => setAssigneeIds([])} />
                  Everyone
                </label>
                {memberIds.map((id) => (
                  <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="checkbox"
                      checked={assigneeIds.includes(id)}
                      onChange={() =>
                        setAssigneeIds((prev) =>
                          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                        )
                      }
                    />
                    {memberNames[id] ?? id}
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && <p style={{ color: 'var(--owe)', margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            {editPlace ? (
              <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            ) : (
              <button type="button" className="btn btn-outline" onClick={() => setType(null)}>Back</button>
            )}
            <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}