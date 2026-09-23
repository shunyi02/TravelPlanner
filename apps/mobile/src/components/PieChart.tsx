import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme, type ThemeColors } from '../theme';

export interface PieSlice {
  key: string;
  label: string;
  amount: number;
  color: string;
}

interface RenderedSlice extends PieSlice {
  pct: number;
  startAngle: number;
  endAngle: number;
}

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  // A single slice that fills the whole pie renders as a full circle — draw
  // it directly rather than a 360° arc, which degenerates to a point.
  if (endAngle - startAngle >= 359.999) {
    return `M ${cx - r},${cy} A ${r},${r} 0 1 1 ${cx + r},${cy} A ${r},${r} 0 1 1 ${cx - r},${cy} Z`;
  }
  const start = polarPoint(cx, cy, r, startAngle);
  const end = polarPoint(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx},${cy} L ${start.x},${start.y} A ${r},${r} 0 ${largeArc} 1 ${end.x},${end.y} Z`;
}

/** Generic pie chart with a tap-linked legend. Callers supply pre-colored,
 *  pre-filtered (amount > 0) slices in the order they should appear around
 *  the ring. Ported from the web app's hand-rolled SVG pie chart, using
 *  react-native-svg in place of raw <svg>. */
export function PieChart({
  title,
  slices,
  currency,
}: {
  title: string;
  slices: PieSlice[];
  currency: string;
}) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const [selected, setSelected] = useState<string | null>(null);

  const grandTotal = slices.reduce((sum, s) => sum + s.amount, 0);
  if (grandTotal <= 0) return null;

  let cursor = 0;
  const rendered: RenderedSlice[] = slices.map((slice) => {
    const pct = slice.amount / grandTotal;
    const startAngle = cursor * 360;
    cursor += pct;
    const endAngle = cursor * 360;
    return { ...slice, pct, startAngle, endAngle };
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.body}>
        <Svg width={160} height={160} viewBox="0 0 200 200">
          {rendered.map((slice) => (
            <Path
              key={slice.key}
              d={slicePath(100, 100, 90, slice.startAngle, slice.endAngle)}
              fill={slice.color}
              stroke={colors.surface}
              strokeWidth={2}
              opacity={selected && selected !== slice.key ? 0.55 : 1}
              onPress={() => setSelected(selected === slice.key ? null : slice.key)}
            />
          ))}
        </Svg>

        <View style={styles.legend}>
          {rendered.map((slice) => (
            <Pressable
              key={slice.key}
              style={styles.legendRow}
              onPress={() => setSelected(selected === slice.key ? null : slice.key)}
            >
              <View style={[styles.swatch, { backgroundColor: slice.color }]} />
              <Text style={styles.legendName} numberOfLines={1}>
                {slice.label}
              </Text>
              <Text style={styles.legendAmount}>
                {currency} {slice.amount.toFixed(2)} · {Math.round(slice.pct * 100)}%
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { marginVertical: 12 },
    title: { fontSize: 13, color: colors.inkSoft, marginBottom: 8 },
    body: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
    legend: { flex: 1, minWidth: 160, gap: 6 },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    swatch: { width: 10, height: 10, borderRadius: 5 },
    legendName: { fontSize: 12, color: colors.ink, flexShrink: 1 },
    legendAmount: { fontSize: 12, color: colors.inkSoft, marginLeft: 'auto' },
  });
}
