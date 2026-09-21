import { useRef, useState } from 'react';
import { EXPENSE_CATEGORIES } from '@travel-planner/shared';
import type { Expense } from '../api';
import { CATEGORICAL_HUES, NEUTRAL_HUE } from '../palette';

/**
 * Matches EXPENSE_CATEGORIES' order 1:1 (the ring is already ordered so
 * every consecutive pair — including the wrap from the last slice back to
 * the first — clears the CVD/contrast gates), so a category always gets
 * the same color regardless of which other categories are present.
 *
 * A pie's slice neighbors change with the data (which categories are
 * present), so not every possible pair of these 7 hues clears the stricter
 * all-pairs bar the skill uses for scatter/small-multiples — full CVD
 * safety across every possible subset isn't guaranteed by hue alone at 7
 * categories. The always-visible legend (name + amount + percent) is the
 * mitigation: nobody has to tell two categories apart by color alone.
 */
const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((cat, i) => [cat, CATEGORICAL_HUES[i] ?? NEUTRAL_HUE]),
);

interface Slice {
  category: string;
  amount: number;
  pct: number;
  color: string;
  startAngle: number;
  endAngle: number;
}

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  // A single category's expenses render as a full circle — draw it directly
  // rather than a 360° arc, which degenerates to a point.
  if (endAngle - startAngle >= 359.999) {
    return `M ${cx - r},${cy} A ${r},${r} 0 1 1 ${cx + r},${cy} A ${r},${r} 0 1 1 ${cx - r},${cy} Z`;
  }
  const start = polarPoint(cx, cy, r, startAngle);
  const end = polarPoint(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx},${cy} L ${start.x},${start.y} A ${r},${r} 0 ${largeArc} 1 ${end.x},${end.y} Z`;
}

export function CategoryPieChart({ expenses, currency }: { expenses: Expense[]; currency: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; category: string; amount: number; pct: number } | null>(null);

  const totals = new Map<string, number>();
  for (const expense of expenses) {
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + Number(expense.amount));
  }
  const grandTotal = [...totals.values()].reduce((sum, v) => sum + v, 0);

  if (grandTotal <= 0) return null;

  let cursor = 0;
  const slices: Slice[] = EXPENSE_CATEGORIES.filter((cat) => (totals.get(cat) ?? 0) > 0).map((cat) => {
    const amount = totals.get(cat)!;
    const pct = amount / grandTotal;
    const startAngle = cursor * 360;
    cursor += pct;
    const endAngle = cursor * 360;
    return { category: cat, amount, pct, color: CATEGORY_COLORS[cat] ?? '#898781', startAngle, endAngle };
  });

  const showTooltip = (e: React.MouseEvent, slice: Slice) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      category: slice.category,
      amount: slice.amount,
      pct: slice.pct,
    });
  };

  return (
    <div className="category-pie" ref={containerRef}>
      <p className="sidebar-section-label">By category</p>
      <div className="category-pie-body">
        <svg viewBox="0 0 200 200" width={200} height={200} role="img" aria-label="Expenses by category">
          {slices.map((slice) => (
            <path
              key={slice.category}
              d={slicePath(100, 100, 90, slice.startAngle, slice.endAngle)}
              fill={slice.color}
              stroke="var(--surface)"
              strokeWidth={2}
              opacity={hovered && hovered !== slice.category ? 0.55 : 1}
              tabIndex={0}
              aria-label={`${slice.category}: ${currency} ${slice.amount.toFixed(2)}, ${Math.round(slice.pct * 100)}%`}
              onMouseMove={(e) => {
                setHovered(slice.category);
                showTooltip(e, slice);
              }}
              onMouseLeave={() => {
                setHovered(null);
                setTooltip(null);
              }}
              onFocus={() => setHovered(slice.category)}
              onBlur={() => setHovered(null)}
              style={{ cursor: 'pointer', transition: 'opacity 0.12s ease' }}
            />
          ))}
        </svg>

        <ul className="category-pie-legend">
          {slices.map((slice) => (
            <li
              key={slice.category}
              className={`category-pie-legend-row${hovered === slice.category ? ' active' : ''}`}
              onMouseEnter={() => setHovered(slice.category)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="category-pie-swatch" style={{ background: slice.color }} />
              <span className="category-pie-legend-name">{slice.category}</span>
              <span className="category-pie-legend-amount">
                {currency} {slice.amount.toFixed(2)} · {Math.round(slice.pct * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>

      {tooltip && (
        <div className="category-pie-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}>
          <strong>{currency} {tooltip.amount.toFixed(2)}</strong>
          <span>{tooltip.category} · {Math.round(tooltip.pct * 100)}%</span>
        </div>
      )}
    </div>
  );
}
