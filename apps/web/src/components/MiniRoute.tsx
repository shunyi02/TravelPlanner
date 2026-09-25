const PAD = 22;

/** Project [lat, lng] pairs into the SVG viewBox: equirectangular, with
 *  longitude squeezed by cos(mean latitude) so shapes aren't stretched, then
 *  uniformly scaled and centered to fit. Consecutive duplicates are dropped. */
function project(route: [number, number][], w: number, h: number): Array<{ x: number; y: number }> {
  const pts = route.filter((p, i) => i === 0 || p[0] !== route[i - 1][0] || p[1] !== route[i - 1][1]);
  const meanLat = pts.reduce((sum, [lat]) => sum + lat, 0) / pts.length;
  const k = Math.cos((meanLat * Math.PI) / 180);
  const raw = pts.map(([lat, lng]) => ({ x: lng * k, y: -lat }));

  const xs = raw.map((p) => p.x);
  const ys = raw.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  const scale = Math.min((w - PAD * 2) / (spanX || 1), (h - PAD * 2) / (spanY || 1));
  const offX = (w - spanX * scale) / 2;
  const offY = (h - spanY * scale) / 2;
  return raw.map((p) => ({ x: offX + (p.x - minX) * scale, y: offY + (p.y - minY) * scale }));
}

/** A small sketch of a trip's actual route, used on trip cards that have no
 *  cover photo. Decorative: the card's text already names the trip.
 *  `width`/`height` set the drawing canvas; size it roughly to the rendered
 *  box so strokes and dots come out the same size on small and large cards. */
export function MiniRoute({
  route,
  className,
  width = 320,
  height = 160,
}: {
  route: [number, number][];
  className?: string;
  width?: number;
  height?: number;
}) {
  const pts = route.length ? project(route, width, height) : [];
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const start = pts[0];
  const end = pts[pts.length - 1];

  return (
    <div className={`mini-route${className ? ` ${className}` : ''}`} aria-hidden="true">
      {pts.length > 0 && (
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
          {pts.length > 1 && (
            <>
              <path className="mini-route-halo" d={d} />
              <path className="mini-route-line" d={d} pathLength={1} />
            </>
          )}
          {pts.slice(1, -1).map((p, i) => (
            <circle key={i} className="mini-route-stop" cx={p.x} cy={p.y} r={3} />
          ))}
          {pts.length === 1 ? (
            <>
              <circle className="mini-route-pulse" cx={start.x} cy={start.y} r={14} />
              <circle className="mini-route-end" cx={start.x} cy={start.y} r={6} />
            </>
          ) : (
            <>
              <circle className="mini-route-start" cx={start.x} cy={start.y} r={5} />
              <circle className="mini-route-end" cx={end.x} cy={end.y} r={6} />
            </>
          )}
        </svg>
      )}
    </div>
  );
}
