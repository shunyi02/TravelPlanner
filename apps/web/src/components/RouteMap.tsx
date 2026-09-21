import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip } from 'react-leaflet';
import { hueForIndex, NEUTRAL_HUE } from '../palette';

/** A colored numbered badge (the same visual language as the itinerary
 *  list's .stop-index circle) instead of Leaflet's default pin image, so
 *  each day's stops read as one color on the map. */
function dayMarkerIcon(color: string, order: number) {
  return L.divIcon({
    className: 'route-map-pin',
    html: `<span style="background:${color}">${order}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export interface RouteStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** 1-based position in the trip's visit order, shown in the marker tooltip. */
  order: number;
  /** Day-bucket key ("YYYY-MM-DD"), or "" if unscheduled — pins/route
   *  segments are colored per distinct value, in first-seen order. */
  day: string;
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
 *  order, with a line from each to the next. Each distinct day gets its own
 *  color (pins + the segments joining that day's own stops), so multiple
 *  days on the same overview map read apart at a glance; a single-day map
 *  (the per-day tabs) naturally renders as one color. Past 7 distinct days,
 *  colors repeat — the order number on each pin is the fallback identity
 *  cue when hue alone runs out. */
export function RouteMap({ stops }: { stops: RouteStop[] }) {
  if (stops.length === 0) return null;

  const positions: [number, number][] = stops.map((s) => [s.lat, s.lng]);
  const single = positions.length === 1;

  const dayOrder: string[] = [];
  for (const s of stops) if (!dayOrder.includes(s.day)) dayOrder.push(s.day);
  const colorForDay = (day: string) => (day ? hueForIndex(dayOrder.indexOf(day)) : NEUTRAL_HUE);

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
        {dayOrder.map((day) => {
          const dayPositions = stops.filter((s) => s.day === day).map((s): [number, number] => [s.lat, s.lng]);
          return (
            dayPositions.length > 1 && (
              <Polyline key={day || '(unscheduled)'} positions={dayPositions} pathOptions={{ color: colorForDay(day), weight: 3 }} />
            )
          );
        })}
        {stops.map((stop) => (
          <Marker
            key={stop.id}
            position={[stop.lat, stop.lng]}
            icon={dayMarkerIcon(colorForDay(stop.day), stop.order)}
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
