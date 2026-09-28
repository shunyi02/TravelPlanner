import { createElement, useMemo, useRef } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { hueForIndex, NEUTRAL_HUE } from '@travel-planner/shared';
import { LEAFLET_CSS, LEAFLET_JS } from '../vendor/leaflet';
import { radius, typeScale, useTheme, type ThemeColors } from '../theme';
import { Tappable } from './Tappable';
import { ArrowSquareOut } from '../icons';

export interface RouteStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  order: number;
  /** Stops with the same colorGroup are connected by one line and share a color. */
  colorGroup: string;
}

export function routeColorMap(stops: RouteStop[]): Map<string, string> {
  const groups: string[] = [];
  for (const s of stops) {
    if (!groups.includes(s.colorGroup)) groups.push(s.colorGroup);
  }
  return new Map(groups.map((g, i) => [g, hueForIndex(i)]));
}

export function googleMapsStopUrl(stop: RouteStop): string {
  return `https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}`;
}

export function googleMapsRouteUrl(stops: RouteStop[]): string {
  if (stops.length === 0) return '';
  const origin = `${stops[0].lat},${stops[0].lng}`;
  const destination = `${stops[stops.length - 1].lat},${stops[stops.length - 1].lng}`;
  const waypoints = stops
    .slice(1, -1)
    .map((s) => `${s.lat},${s.lng}`)
    .join('|');
  const params = new URLSearchParams({ api: '1', origin, destination });
  if (waypoints) params.set('waypoints', waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function buildHtml(stops: RouteStop[], colorByGroup: Map<string, string>): string {
  const points = stops.map((s) => ({
    lat: s.lat,
    lng: s.lng,
    order: s.order,
    color: colorByGroup.get(s.colorGroup) ?? NEUTRAL_HUE,
    group: s.colorGroup,
    url: googleMapsStopUrl(s),
  }));
  // Escape "<" so user text such as a stop named "</script>" stays data inside the page's script.
  const pointsJson = JSON.stringify(points).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>${LEAFLET_CSS}</style>
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    .route-map-pin span {
      display: block; width: 26px; height: 26px; border-radius: 13px;
      color: #fff; font: 12px/26px sans-serif; text-align: center;
      border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>${LEAFLET_JS}</script>
  <script>
    const points = ${pointsJson};
    const map = L.map('map', { scrollWheelZoom: false, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const byGroup = {};
    points.forEach((p) => {
      if (!byGroup[p.group]) byGroup[p.group] = [];
      byGroup[p.group].push(p);
    });
    Object.values(byGroup).forEach((group) => {
      if (group.length >= 2) {
        L.polyline(group.map((p) => [p.lat, p.lng]), { color: group[0].color, weight: 3 }).addTo(map);
      }
    });

    points.forEach((p) => {
      const icon = L.divIcon({
        className: 'route-map-pin',
        html: '<span style="background:' + p.color + '">' + p.order + '</span>',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const marker = L.marker([p.lat, p.lng], { icon }).addTo(map);
      marker.on('click', () => {
        // Native hands the link to the app; on web the map is an iframe, so open a tab directly.
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(p.url);
        else window.open(p.url, '_blank', 'noopener');
      });
    });

    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 13);
    } else {
      map.fitBounds(bounds, { padding: [32, 32] });
    }
  </script>
</body>
</html>`;
}

const MAP_HEIGHT = 220;

export function RouteMap({ stops }: { stops: RouteStop[] }) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const webviewRef = useRef<WebView>(null);

  const colorByGroup = useMemo(() => routeColorMap(stops), [stops]);
  const html = useMemo(() => buildHtml(stops, colorByGroup), [stops, colorByGroup]);

  if (stops.length === 0) return null;

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        // react-native-webview has no web implementation; an iframe renders the same page.
        createElement('iframe', {
          srcDoc: html,
          title: 'Route map',
          // Same origin as the app so tile requests carry a Referer: OSM's tile policy blocks requests
          // without one. Safe only because buildHtml escapes the user text it embeds.
          sandbox: 'allow-scripts allow-same-origin allow-popups',
          style: { height: MAP_HEIGHT, width: '100%', border: `1px solid ${colors.rule}`, borderRadius: radius.sm },
        })
      ) : (
        <WebView
          ref={webviewRef}
          source={{ html }}
          style={styles.map}
          scrollEnabled={false}
          overScrollMode="never"
          originWhitelist={['*']}
          onMessage={(e) => {
            Linking.openURL(e.nativeEvent.data).catch(() => {});
          }}
        />
      )}
      {stops.length > 1 && (
        <Tappable onPress={() => Linking.openURL(googleMapsRouteUrl(stops)).catch(() => {})}>
          <View style={styles.linkRow}>
            <Text style={styles.link}>Open full route in Google Maps</Text>
            <ArrowSquareOut size={12} color={colors.route} />
          </View>
        </Tappable>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { marginVertical: 8 },
    map: { height: MAP_HEIGHT, width: '100%', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.rule },
    linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 6 },
    link: { color: colors.route, fontSize: typeScale.footnote, fontWeight: '500' },
  });
}
