import { useRef, useState } from 'react';
import type { Expense } from '../api';

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

/** One day's total spend, as a single-hue bar chart. A single series names
 *  itself in the title, so no legend is needed (per the dataviz skill). */
export function SpendOverTimeChart({ expenses, currency }: { expenses: Expense[]; currency: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; day: string; amount: number } | null>(null);

  if (expenses.length === 0) return null;

  const totals = new Map<string, number>();
  for (const expense of expenses) {
    const day = expense.expenseDate.slice(0, 10);
    totals.set(day, (totals.get(day) ?? 0) + Number(expense.amount));
  }
  const days = [...totals.keys()].sort();
  const maxAmount = Math.max(...days.map((d) => totals.get(d)!));
  const viewWidth = days.length * (BAR_WIDTH + BAR_GAP) + BAR_GAP;

  const showTooltip = (e: React.MouseEvent, day: string, amount: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, day, amount });
  };

  return (
    <div className="bar-chart" ref={containerRef}>
      <p className="sidebar-section-label">Spend by day</p>
      <div className="bar-chart-body">
        <svg viewBox={`0 0 ${viewWidth} ${VIEW_HEIGHT}`} width={viewWidth} height={VIEW_HEIGHT} role="img" aria-label="Spend by day">
          <line x1={0} y1={BASELINE_Y} x2={viewWidth} y2={BASELINE_Y} className="bar-chart-baseline" />
          {days.map((day, i) => {
            const amount = totals.get(day)!;
            const height = maxAmount > 0 ? Math.max(4, (amount / maxAmount) * CHART_HEIGHT) : 0;
            const x = BAR_GAP + i * (BAR_WIDTH + BAR_GAP);
            const label = new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            return (
              <g key={day}>
                <path
                  className="bar-chart-bar"
                  d={barPath(x, height)}
                  fill="var(--route)"
                  opacity={hovered && hovered !== day ? 0.55 : 1}
                  tabIndex={0}
                  aria-label={`${label}: ${currency} ${amount.toFixed(2)}`}
                  onMouseMove={(e) => {
                    setHovered(day);
                    showTooltip(e, day, amount);
                  }}
                  onMouseLeave={() => {
                    setHovered(null);
                    setTooltip(null);
                  }}
                  onFocus={() => setHovered(day)}
                  onBlur={() => setHovered(null)}
                />
                <text x={x + BAR_WIDTH / 2} y={BASELINE_Y + 16} textAnchor="middle" className="bar-chart-label">
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {tooltip && (
        <div className="chart-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}>
          <strong>{currency} {tooltip.amount.toFixed(2)}</strong>
          <span>{new Date(`${tooltip.day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        </div>
      )}
    </div>
  );
}
