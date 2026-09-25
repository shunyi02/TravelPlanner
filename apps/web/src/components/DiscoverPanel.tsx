import { useEffect, useRef, useState } from 'react';
import { ArrowSquareOut, Check, MagnifyingGlass, MapPin, X } from '@phosphor-icons/react';
import type { TripDetail } from '../api';
import { api } from '../api';
import {
  alreadyPlanned,
  CATEGORIES,
  distanceKm,
  fetchSuggestions,
  type CategoryId,
  type Suggestion,
} from '../discoverPlaces';
import { LocationSearchField } from './LocationSearchField';

interface Area {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

function formatDay(day: string): string {
  return new Date(day + 'T00:00:00Z').toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/** Places to search around: the trip's destination and each hotel, so a
 *  multi-city trip gets every base one tap away. */
function tripAreas(trip: TripDetail): Area[] {
  const areas: Area[] = [];
  if (trip.destinationLat != null && trip.destinationLng != null) {
    areas.push({
      id: 'destination',
      label: trip.destinationName?.split(',')[0] || 'Destination',
      lat: trip.destinationLat,
      lng: trip.destinationLng,
    });
  }
  const seen = new Set<string>();
  for (const p of trip.places) {
    if (p.type !== 'HOTEL' || p.lat == null || p.lng == null || seen.has(p.name)) continue;
    seen.add(p.name);
    areas.push({ id: `hotel-${p.id}`, label: p.name, lat: p.lat, lng: p.lng });
  }
  return areas;
}

/** Side panel for finding well-known places near the trip's bases and
 *  adding them straight onto a day, with the itinerary still in view. */
export function DiscoverPanel({
  tripId,
  trip,
  days,
  viewedDay,
  onAdded,
  onClose,
}: {
  tripId: string;
  trip: TripDetail;
  /** The trip's days ("YYYY-MM-DD"); empty when the trip has no dates. */
  days: string[];
  /** The day open in the itinerary, if any: the default day to add to. */
  viewedDay: string | null;
  onAdded: () => void;
  onClose: () => void;
}) {
  const [customAreas, setCustomAreas] = useState<Area[]>([]);
  const areas = [...tripAreas(trip), ...customAreas];
  const [areaId, setAreaId] = useState<string | null>(areas[0]?.id ?? null);
  const [searching, setSearching] = useState(areas.length === 0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryId>('landmarks');
  const [results, setResults] = useState<Suggestion[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [reload, setReload] = useState(0);
  const [addDay, setAddDay] = useState(viewedDay ?? '');
  // Suggestion id -> the place it created, so its card can offer Undo.
  const [added, setAdded] = useState<Map<string, { placeId: string; day: string }>>(new Map());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const area = areas.find((a) => a.id === areaId) ?? null;

  // Follow the itinerary: picking another day behind the panel retargets it.
  useEffect(() => setAddDay(viewedDay ?? ''), [viewedDay]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // On wide screens the page makes room for the panel instead of hiding under it.
    document.body.classList.add('discover-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('discover-open');
    };
  }, [onClose]);

  useEffect(() => {
    if (!area) return;
    let current = true;
    setStatus('loading');
    setResults(null);
    fetchSuggestions(area.lat, area.lng, category)
      .then((r) => {
        if (!current) return;
        setResults(r);
        setStatus('idle');
      })
      .catch(() => current && setStatus('error'));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area?.lat, area?.lng, category, reload]);

  const handleAdd = async (s: Suggestion) => {
    setBusyId(s.id);
    setActionError(null);
    try {
      // Local noon keeps the stop on the chosen calendar day in any timezone
      // and slots it mid-day among that day's stops.
      const place = await api.addPlace(tripId, {
        type: 'STOP',
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        ...(addDay ? { visitDate: new Date(`${addDay}T12:00:00`).toISOString() } : {}),
      });
      setAdded((prev) => new Map(prev).set(s.id, { placeId: place.id, day: addDay }));
      onAdded();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Couldn't add ${s.name}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleUndo = async (s: Suggestion) => {
    const entry = added.get(s.id);
    if (!entry) return;
    setBusyId(s.id);
    setActionError(null);
    try {
      await api.deletePlace(tripId, entry.placeId);
      setAdded((prev) => {
        const next = new Map(prev);
        next.delete(s.id);
        return next;
      });
      onAdded();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Couldn't remove ${s.name}`);
    } finally {
      setBusyId(null);
    }
  };

  // Just-added places stay listed (with Undo) even though they're now "planned".
  const visible = (results ?? []).filter((s) => added.has(s.id) || !alreadyPlanned(s, trip.places));
  const hiddenCount = (results?.length ?? 0) - visible.length;
  const addLabel = (day: string) => (day ? `Add to ${formatDay(day)}` : 'Add to plan');
  const addedLabel = (day: string) => (day ? `Added to ${formatDay(day)}` : 'Added, no day yet');

  return (
    <>
      <div className="discover-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="discover" role="dialog" aria-modal="false" aria-labelledby="discover-title">
        <header className="discover-head">
          <h2 className="discover-title" id="discover-title">
            Discover places
          </h2>
          <button type="button" className="discover-close" ref={closeRef} onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="discover-controls">
          <div className="discover-field">
            <span className="discover-label" id="discover-near">
              Near
            </span>
            <div className="discover-chips" role="group" aria-labelledby="discover-near">
              {areas.map((a) => (
                <button
                  type="button"
                  key={a.id}
                  className="discover-chip"
                  aria-pressed={a.id === areaId && !searching}
                  onClick={() => {
                    setAreaId(a.id);
                    setSearching(false);
                  }}
                >
                  {a.label}
                </button>
              ))}
              <button
                type="button"
                className="discover-chip discover-chip-search"
                aria-pressed={searching}
                onClick={() => setSearching((v) => !v)}
              >
                <MagnifyingGlass size={13} aria-hidden /> Elsewhere…
              </button>
            </div>
            {searching && (
              <div className="discover-search">
                <LocationSearchField
                  query={query}
                  onQueryChange={setQuery}
                  onPick={(pick) => {
                    const id = `custom-${pick.lat.toFixed(4)},${pick.lng.toFixed(4)}`;
                    setCustomAreas((prev) =>
                      prev.some((a) => a.id === id)
                        ? prev
                        : // Label it as typed: the geocoder's names can be in the local script.
                          [...prev, { id, label: query.trim() || pick.name, lat: pick.lat, lng: pick.lng }],
                    );
                    setAreaId(id);
                    setSearching(false);
                    setQuery('');
                  }}
                  placeholder="Search a city or area…"
                  showMap={false}
                  autoFocus
                />
              </div>
            )}
          </div>

          <div className="discover-categories" role="group" aria-label="Category">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c.id}
                className="discover-category"
                aria-pressed={category === c.id}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>

          {days.length > 0 && (
            <label className="discover-field discover-day">
              <span className="discover-label">Add to</span>
              <select value={addDay} onChange={(e) => setAddDay(e.target.value)}>
                {days.map((d, i) => (
                  <option key={d} value={d}>
                    {formatDay(d)} · Day {i + 1}
                  </option>
                ))}
                <option value="">No day yet (Unscheduled)</option>
              </select>
            </label>
          )}
        </div>

        <div className="discover-results" aria-live="polite" aria-busy={status === 'loading'}>
          {actionError && <p className="form-error">{actionError}</p>}

          {!area ? (
            <p className="discover-empty">Search for a city or area to see well-known places nearby.</p>
          ) : status === 'loading' ? (
            <ul className="discover-list" aria-label="Loading places">
              {[0, 1, 2, 3].map((i) => (
                <li className="discover-card discover-card-skeleton" key={i}>
                  <span className="discover-photo" />
                  <span className="discover-card-body">
                    <span className="discover-skel-line" />
                    <span className="discover-skel-line discover-skel-line-short" />
                  </span>
                </li>
              ))}
            </ul>
          ) : status === 'error' ? (
            <div className="discover-empty">
              <p>Couldn't reach Wikidata to load suggestions.</p>
              <button type="button" className="btn btn-outline" onClick={() => setReload((n) => n + 1)}>
                Try again
              </button>
            </div>
          ) : visible.length === 0 ? (
            <p className="discover-empty">
              {hiddenCount > 0
                ? `Everything well-known here is already in your plan. Try another category.`
                : `No well-known ${CATEGORIES.find((c) => c.id === category)!.label.toLowerCase()} near ${area.label}. Try another category or area.`}
            </p>
          ) : (
            <>
              <ul className="discover-list">
                {visible.map((s) => {
                  const done = added.get(s.id);
                  return (
                    <li className={`discover-card${done ? ' discover-card-added' : ''}`} key={s.id}>
                      {s.imageUrl ? (
                        <a className="discover-photo-link" href={s.imagePage} target="_blank" rel="noreferrer">
                          <img className="discover-photo" src={s.imageUrl} alt="" loading="lazy" />
                          <span className="visually-hidden">Photo of {s.name}: author and licence (opens in a new tab)</span>
                        </a>
                      ) : (
                        <span className="discover-photo discover-photo-empty">
                          <MapPin size={26} weight="duotone" aria-hidden />
                        </span>
                      )}
                      <div className="discover-card-body">
                        <span className="discover-name">{s.name}</span>
                        <span className="discover-meta">
                          {s.kind} · {formatDistance(distanceKm(area.lat, area.lng, s.lat, s.lng))}
                        </span>
                        <a className="discover-link" href={s.url} target="_blank" rel="noreferrer">
                          Wikipedia <ArrowSquareOut size={12} aria-hidden />
                          <span className="visually-hidden"> (opens in a new tab)</span>
                        </a>
                        <div className="discover-card-actions">
                          {done ? (
                            <>
                              <span className="discover-added">
                                <Check size={14} weight="bold" aria-hidden /> {addedLabel(done.day)}
                              </span>
                              <button
                                type="button"
                                className="text-btn"
                                disabled={busyId === s.id}
                                onClick={() => handleUndo(s)}
                              >
                                Undo
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-outline discover-add"
                              disabled={busyId === s.id}
                              onClick={() => handleAdd(s)}
                            >
                              {busyId === s.id ? 'Adding…' : `+ ${addLabel(addDay)}`}
                              <span className="visually-hidden">: {s.name}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {hiddenCount > 0 && (
                <p className="discover-note">
                  {hiddenCount} {hiddenCount === 1 ? 'place is' : 'places are'} already in your plan and hidden.
                </p>
              )}
            </>
          )}
        </div>

        <footer className="discover-foot">
          Places from{' '}
          <a href="https://www.wikidata.org" target="_blank" rel="noreferrer">
            Wikidata
          </a>
          , photos from{' '}
          <a href="https://commons.wikimedia.org" target="_blank" rel="noreferrer">
            Wikimedia Commons
          </a>
          . Open a photo for its author and licence.
        </footer>
      </aside>
    </>
  );
}
