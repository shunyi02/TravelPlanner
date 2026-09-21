import { useEffect, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api, type Place, type PlaceType } from '../api';

type FlightTripType = 'ONE_WAY' | 'ROUND_TRIP';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

/** Same colored-badge look as the trip route map, just a single fixed pin
 *  here — no per-day coloring needed for a one-location preview. */
const previewPinIcon = L.divIcon({
  className: 'route-map-pin',
  html: `<span style="background:#2b6e5e"></span>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const PLACE_TYPE_INFO: Record<PlaceType, { label: string; icon: string; hint: string }> = {
  STOP: { label: 'Stop', icon: '📍', hint: 'A place to visit — attraction, restaurant, etc.' },
  HOTEL: { label: 'Hotel', icon: '🏨', hint: 'Where you’re staying, with check-in/out' },
  FLIGHT: { label: 'Flight', icon: '✈️', hint: 'A flight leg, one-way or round trip' },
};

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
  const [locationResults, setLocationResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [touchedLocation, setTouchedLocation] = useState(false);
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // datetime-local needs "YYYY-MM-DDTHH:mm" bounds, not just a date
  const dtMin = tripStartDate ? `${tripStartDate}T00:00` : undefined;
  const dtMax = tripEndDate ? `${tripEndDate}T23:59` : undefined;

  // Debounced Nominatim (OpenStreetMap) search — free, no API key.
  // Rate-limited to ~1req/s per their usage policy, so wait for typing to pause.
  useEffect(() => {
    if (!touchedLocation || (type !== 'STOP' && type !== 'HOTEL') || locationQuery.trim().length < 3) {
      setLocationResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(locationQuery)}`,
        );
        const data: NominatimResult[] = await res.json();
        setLocationResults(data);
      } catch {
        setLocationResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [locationQuery, type, touchedLocation]);

  const pickLocation = (result: NominatimResult) => {
    setName(result.display_name.split(',')[0]);
    setLat(parseFloat(result.lat));
    setLng(parseFloat(result.lon));
    setLocationQuery(result.display_name);
    setLocationResults([]);
  };

  /** Switch the type being edited/added. Clears fields specific to the previous type. */
  const changeType = (next: PlaceType) => {
    setType(next);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!type || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (type === 'FLIGHT') {
        const flightData = {
          type,
          name: name.trim(),
          departureTime: departureTime || undefined,
          arrivalTime: arrivalTime || undefined,
          departureAirport: departureAirport || undefined,
          arrivalAirport: arrivalAirport || undefined,
        };
        if (editPlace) {
          await api.updatePlace(tripId, editPlace.id, flightData);
        } else {
          await api.addPlace(tripId, flightData);
          if (tripType === 'ROUND_TRIP') {
            await api.addPlace(tripId, {
              type,
              name: `${name.trim()} (return)`,
              departureTime: returnDepartureTime || undefined,
              arrivalTime: returnArrivalTime || undefined,
              // swapped: return leg goes arrival -> departure
              departureAirport: arrivalAirport || undefined,
              arrivalAirport: departureAirport || undefined,
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
            <div style={{ position: 'relative' }}>
              <input
                placeholder="Search a place…"
                value={locationQuery}
                onChange={(e) => {
                  setTouchedLocation(true);
                  setLocationQuery(e.target.value);
                  setName(e.target.value);
                  setLat(undefined);
                  setLng(undefined);
                }}
                autoFocus
                required
              />
              {searching && (
                <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '4px 0 0' }}>Searching…</p>
              )}
              {locationResults.length > 0 && (
                <ul
                  style={{
                    listStyle: 'none',
                    margin: '4px 0 0',
                    padding: 0,
                    border: '1px solid var(--rule)',
                    borderRadius: 6,
                    maxHeight: 180,
                    overflowY: 'auto',
                    background: 'var(--surface)',
                    position: 'absolute',
                    width: '100%',
                    zIndex: 10,
                  }}
                >
                  {locationResults.map((r) => (
                    <li key={r.place_id}>
                      <button
                        type="button"
                        onClick={() => pickLocation(r)}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 10px',
                          background: 'none',
                          border: 'none',
                          fontSize: 13,
                        }}
                      >
                        {r.display_name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {lat !== undefined && lng !== undefined && (
                <>
                  <p style={{ fontSize: 12, color: 'var(--route)', margin: '4px 0 0' }}>
                    📍 {lat.toFixed(5)}, {lng.toFixed(5)}
                  </p>
                  <div className="location-preview-map">
                    <MapContainer
                      key={`${lat},${lng}`}
                      center={[lat, lng]}
                      zoom={14}
                      scrollWheelZoom={false}
                      dragging={false}
                      zoomControl={false}
                      style={{ height: 140, width: '100%' }}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <Marker position={[lat, lng]} icon={previewPinIcon} />
                    </MapContainer>
                  </div>
                </>
              )}
            </div>
          ) : (
            <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
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

              <input placeholder="Departure airport" value={departureAirport} onChange={(e) => setDepartureAirport(e.target.value)} />
              <input placeholder="Arrival airport" value={arrivalAirport} onChange={(e) => setArrivalAirport(e.target.value)} />

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