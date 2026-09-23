import { useMemo, useRef } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { hueForIndex } from '../palette';
import { useTheme, type ThemeColors } from '../theme';

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
    color: colorByGroup.get(s.colorGroup) ?? '#898781',
    group: s.colorGroup,
    url: googleMapsStopUrl(s),
  }));

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
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
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const points = ${JSON.stringify(points)};
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
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(p.url);
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

export function RouteMap({ stops }: { stops: RouteStop[] }) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const webviewRef = useRef<WebView>(null);

  const colorByGroup = useMemo(() => routeColorMap(stops), [stops]);
  const html = useMemo(() => buildHtml(stops, colorByGroup), [stops, colorByGroup]);

  if (stops.length === 0) return null;

  return (
    <View style={styles.container}>
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
      {stops.length > 1 && (
        <Pressable onPress={() => Linking.openURL(googleMapsRouteUrl(stops)).catch(() => {})}>
          <Text style={styles.link}>Open full route in Google Maps ↗</Text>
        </Pressable>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { marginVertical: 8 },
    map: { height: 220, width: '100%', borderRadius: 8, borderWidth: 1, borderColor: colors.rule },
    link: { color: colors.route, fontSize: 13, marginTop: 6, textAlign: 'center' },
  });
}
