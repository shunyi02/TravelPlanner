import { Fragment } from 'react';
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

/** A small triangle, same shape as the app's own logo mark, rotated to the
 *  segment's bearing — shows *direction* along a line, which matters once
 *  lines can diverge and reconverge and a plain line no longer reads as
 *  obviously sequential. */
function arrowIcon(color: string, angleDeg: number) {
  return L.divIcon({
    className: 'route-map-arrow',
    html: `<span style="background:${color}; transform: rotate(${angleDeg}deg)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

/** Compass-style bearing (0° = toward increasing lat, 90° = toward
 *  increasing lng) from `a` to `b` — planar, not geodesic, which matches the
 *  straight-line Polyline these arrows sit on. */
function bearing(a: [number, number], b: [number, number]): number {
  const [latA, lngA] = a;
  const [latB, lngB] = b;
  return (Math.atan2(lngB - lngA, latB - latA) * 180) / Math.PI;
}

function midpoint(a: [number, number], b: [number, number]): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

export interface RouteStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** 1-based position within this stop's day, shown in the marker tooltip. */
  order: number;
  /** This pin's own color identity. "" renders neutral — either genuinely
   *  unscheduled, or a stop everyone shares on a day that's otherwise split
   *  into sub-groups (so the shared stop reads as a common point, not as
   *  "belonging" to whichever sub-group happened to get a color first). */
  colorGroup: string;
  /** Which route line(s) this point sits on. Usually just its own day; a
   *  shared stop on a split day sits on *every* sub-group's line that day,
   *  so those lines visibly reconverge there instead of just ending. */
  lineGroups: string[];
}

/** colorGroup -> hue, assigned in first-seen order across `stops`. Exported
 *  so the itinerary list can color-match its rows to each stop's map pin. */
export function routeColorMap(stops: RouteStop[]): Map<string, string> {
  const order: string[] = [];
  for (const s of stops) {
    if (s.colorGroup && !order.includes(s.colorGroup)) order.push(s.colorGroup);
  }
  const colors = new Map<string, string>();
  for (const s of stops) {
    colors.set(s.colorGroup, s.colorGroup ? hueForIndex(order.indexOf(s.colorGroup)) : NEUTRAL_HUE);
  }
  return colors;
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
 *  order, with a line joining each day's own stops. A day split across
 *  sub-groups becomes several colored lines instead of one, and a stop
 *  everyone shares that day sits on all of them — so the lines visibly
 *  diverge for the split and reconverge wherever the group is back
 *  together, rather than drawing a line between two people going to
 *  different places. Past 7 distinct colors, hues repeat — the order number
 *  on each pin is the fallback identity cue when hue alone runs out. */
export function RouteMap({ stops }: { stops: RouteStop[] }) {
  if (stops.length === 0) return null;

  const positions: [number, number][] = stops.map((s) => [s.lat, s.lng]);
  const single = positions.length === 1;

  const colorFor = routeColorMap(stops);

  const lineKeys: string[] = [];
  for (const s of stops) {
    for (const key of s.lineGroups) {
      if (!lineKeys.includes(key)) lineKeys.push(key);
    }
  }

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
        {lineKeys.map((key) => {
          const linePositions = stops
            .filter((s) => s.lineGroups.includes(key))
            .map((s): [number, number] => [s.lat, s.lng]);
          if (linePositions.length < 2) return null;
          const color = colorFor.get(key) ?? NEUTRAL_HUE;
          return (
            <Fragment key={key || '(unscheduled)'}>
              <Polyline positions={linePositions} pathOptions={{ color, weight: 3 }} />
              {linePositions.slice(1).map((point, i) => (
                <Marker
                  key={i}
                  position={midpoint(linePositions[i], point)}
                  icon={arrowIcon(color, bearing(linePositions[i], point))}
                  interactive={false}
                  keyboard={false}
                />
              ))}
            </Fragment>
          );
        })}
        {stops.map((stop) => (
          <Marker
            key={stop.id}
            position={[stop.lat, stop.lng]}
            icon={dayMarkerIcon(colorFor.get(stop.colorGroup) ?? NEUTRAL_HUE, stop.order)}
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
