import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip } from 'react-leaflet';

// Leaflet's default marker icon points at relative image paths that don't
// survive bundling; point it at the bundled asset URLs instead.
const markerIconDefault = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface RouteStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** 1-based position in the trip's visit order, shown in the marker tooltip. */
  order: number;
}

/** A Google Maps deep link for one stop — just a URL, no API key or billing. */
function googleMapsStopUrl(stop: RouteStop): string {
  return `https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}`;
}

/** A Google Maps directions deep link across every stop in visit order —
 *  same free URL scheme, just with an origin/destination/waypoints. */
function googleMapsRouteUrl(stops: RouteStop[]): string {
  const coord = (s: RouteStop) => `${s.lat},${s.lng}`;
  const origin = coord(stops[0]);
  const destination = coord(stops[stops.length - 1]);
  const waypoints = stops.slice(1, -1).map(coord).join('|');
  const params = new URLSearchParams({ api: '1', origin, destination });
  if (waypoints) params.set('waypoints', waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** The whole trip's route: a numbered pin per located stop/hotel, in visit
 *  order, with a line from each to the next. */
export function RouteMap({ stops }: { stops: RouteStop[] }) {
  if (stops.length === 0) return null;

  const positions: [number, number][] = stops.map((s) => [s.lat, s.lng]);
  const single = positions.length === 1;

  return (
    <div className="route-map">
      <MapContainer
        key={stops.map((s) => s.id).join(',')}
        {...(single ? { center: positions[0], zoom: 13 } : { bounds: positions, boundsOptions: { padding: [32, 32] } })}
        scrollWheelZoom={false}
        style={{ height: 320, width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {positions.length > 1 && <Polyline positions={positions} pathOptions={{ color: '#2b6e5e', weight: 3 }} />}
        {stops.map((stop) => (
          <Marker
            key={stop.id}
            position={[stop.lat, stop.lng]}
            icon={markerIconDefault}
            eventHandlers={{ click: () => window.open(googleMapsStopUrl(stop), '_blank', 'noopener') }}
          >
            <Tooltip direction="top" offset={[0, -34]}>
              {stop.order}. {stop.name} — click for Google Maps
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>

      {stops.length > 1 && (
        <a
          className="route-map-open-link"
          href={googleMapsRouteUrl(stops)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open full route in Google Maps ↗
        </a>
      )}
    </div>
  );
}
