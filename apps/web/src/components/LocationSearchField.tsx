import { useEffect, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export interface LocationPick {
  name: string;
  lat: number;
  lng: number;
  displayName: string;
}

/** Same colored-badge look as the trip route map, just a single fixed pin
 *  here — no per-day coloring needed for a one-location preview. */
const previewPinIcon = L.divIcon({
  className: 'route-map-pin',
  html: `<span style="background:#2b6e5e"></span>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

/** Search-as-you-type place lookup (debounced Nominatim/OpenStreetMap —
 *  free, no API key, ~1req/s per their usage policy) with a dropdown of
 *  matches and an optional small preview map once a result is picked.
 *  `query`/`lat`/`lng` are controlled by the parent, which owns the picked
 *  location's final state (and clears lat/lng when the text changes after
 *  a pick — see the `onQueryChange` call site). */
export function LocationSearchField({
  query,
  onQueryChange,
  onPick,
  lat,
  lng,
  placeholder = 'Search a place…',
  autoFocus,
  showMap = true,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  onPick: (result: LocationPick) => void;
  lat?: number;
  lng?: number;
  placeholder?: string;
  autoFocus?: boolean;
  showMap?: boolean;
}) {
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched || query.trim().length < 3) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`,
        );
        const data: NominatimResult[] = await res.json();
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [query, touched]);

  const pick = (result: NominatimResult) => {
    setResults([]);
    // The parent sets `query` to the full display name after a pick — stop
    // treating that as user input, or the search effect re-fires and the
    // dropdown reopens on the just-picked value.
    setTouched(false);
    onPick({
      name: result.display_name.split(',')[0],
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      displayName: result.display_name,
    });
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setTouched(true);
          onQueryChange(e.target.value);
        }}
        autoFocus={autoFocus}
        required
      />
      {searching && <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '4px 0 0' }}>Searching…</p>}
      {results.length > 0 && (
        <ul className="autocomplete-list">
          {results.map((r) => (
            <li key={r.place_id}>
              <button type="button" onClick={() => pick(r)}>
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
          {showMap && (
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
          )}
        </>
      )}
    </div>
  );
}
