import { Fragment, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import type { Expense } from '../api';
import { useTheme, type ThemeColors } from '../theme';

const BAR_WIDTH = 24;
const BAR_GAP = 16;
const CHART_HEIGHT = 140;
const BASELINE_Y = 150;
const VIEW_HEIGHT = 190;

function barPath(x: number, height: number): string {
  const y = BASELINE_Y - height;
  const r = Math.min(4, height, BAR_WIDTH / 2);
  // Rounded top corners only — the bar stays flush with the baseline.
  return `M ${x},${BASELINE_Y} L ${x},${y + r} A ${r},${r} 0 0 1 ${x + r},${y} L ${x + BAR_WIDTH - r},${y} A ${r},${r} 0 0 1 ${x + BAR_WIDTH},${y + r} L ${x + BAR_WIDTH},${BASELINE_Y} Z`;
}

/** One day's total spend, as a single-hue bar chart. Ported from the web
 *  app's hand-rolled SVG bar chart, horizontally scrollable for many days. */
export function SpendOverTimeChart({ expenses, currency }: { expenses: Expense[]; currency: string }) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const [selected, setSelected] = useState<string | null>(null);

  if (expenses.length === 0) return null;

  const totals = new Map<string, number>();
  for (const expense of expenses) {
    const day = expense.expenseDate.slice(0, 10);
    totals.set(day, (totals.get(day) ?? 0) + Number(expense.amount));
  }
  const days = [...totals.keys()].sort();
  const maxAmount = Math.max(...days.map((d) => totals.get(d)!));
  const viewWidth = days.length * (BAR_WIDTH + BAR_GAP) + BAR_GAP;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Spend by day</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={viewWidth} height={VIEW_HEIGHT} viewBox={`0 0 ${viewWidth} ${VIEW_HEIGHT}`}>
          <Line x1={0} y1={BASELINE_Y} x2={viewWidth} y2={BASELINE_Y} stroke={colors.rule} strokeWidth={1} />
          {days.map((day, i) => {
            const amount = totals.get(day)!;
            const height = maxAmount > 0 ? Math.max(4, (amount / maxAmount) * CHART_HEIGHT) : 0;
            const x = BAR_GAP + i * (BAR_WIDTH + BAR_GAP);
            const label = new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            return (
              <Fragment key={day}>
                <Path
                  d={barPath(x, height)}
                  fill={colors.route}
                  opacity={selected && selected !== day ? 0.55 : 1}
                  onPress={() => setSelected(selected === day ? null : day)}
                />
                <SvgText x={x + BAR_WIDTH / 2} y={BASELINE_Y + 16} fontSize={10} fill={colors.inkSoft} textAnchor="middle">
                  {label}
                </SvgText>
              </Fragment>
            );
          })}
        </Svg>
      </ScrollView>
      {selected && (
        <Text style={styles.tooltip}>
          {currency} {totals.get(selected)!.toFixed(2)} ·{' '}
          {new Date(`${selected}T00:00:00`).toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { marginVertical: 12 },
    title: { fontSize: 13, color: colors.inkSoft, marginBottom: 8 },
    tooltip: { fontSize: 12, color: colors.ink, marginTop: 6 },
  });
}
