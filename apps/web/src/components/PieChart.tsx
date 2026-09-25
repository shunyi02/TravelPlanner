import { useRef, useState } from 'react';

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

/** Generic pie chart with a hover-linked legend and tooltip. Callers supply
 *  pre-colored, pre-filtered (amount > 0) slices in the order they should
 *  appear around the ring. */
export function PieChart({
  title,
  ariaLabel,
  slices,
  currency,
}: {
  title: string;
  ariaLabel: string;
  slices: PieSlice[];
  currency: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; amount: number; pct: number } | null>(
    null,
  );

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

  const showTooltip = (e: React.MouseEvent, slice: RenderedSlice) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, label: slice.label, amount: slice.amount, pct: slice.pct });
  };

  return (
    <div className="pie-chart" ref={containerRef}>
      <p className="sidebar-section-label">{title}</p>
      <div className="pie-chart-body">
        <svg viewBox="0 0 200 200" width={200} height={200} role="img" aria-label={ariaLabel}>
          {rendered.map((slice) => (
            <path
              key={slice.key}
              className="pie-chart-slice"
              d={slicePath(100, 100, 90, slice.startAngle, slice.endAngle)}
              fill={slice.color}
              stroke="var(--surface)"
              strokeWidth={2}
              opacity={hovered && hovered !== slice.key ? 0.55 : 1}
              tabIndex={0}
              aria-label={`${slice.label}: ${currency} ${slice.amount.toFixed(2)}, ${Math.round(slice.pct * 100)}%`}
              onMouseMove={(e) => {
                setHovered(slice.key);
                showTooltip(e, slice);
              }}
              onMouseLeave={() => {
                setHovered(null);
                setTooltip(null);
              }}
              onFocus={() => setHovered(slice.key)}
              onBlur={() => setHovered(null)}
            />
          ))}
        </svg>

        <ul className="pie-chart-legend">
          {rendered.map((slice) => (
            <li
              key={slice.key}
              className={`pie-chart-legend-row${hovered === slice.key ? ' active' : ''}`}
              onMouseEnter={() => setHovered(slice.key)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="pie-chart-swatch" style={{ background: slice.color }} />
              <span className="pie-chart-legend-name">{slice.label}</span>
              <span className="pie-chart-legend-amount">
                {currency} {slice.amount.toFixed(2)} · {Math.round(slice.pct * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>

      {tooltip && (
        <div className="chart-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}>
          <strong>{currency} {tooltip.amount.toFixed(2)}</strong>
          <span>{tooltip.label} · {Math.round(tooltip.pct * 100)}%</span>
        </div>
      )}
    </div>
  );
}
