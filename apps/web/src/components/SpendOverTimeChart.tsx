import type { CSSProperties } from 'react';
import { formatMoney } from '../format';

/** Spend per calendar day across the whole trip, as one-hue columns with a
 *  dashed average line. A single series names itself in the title, so there
 *  is no legend (per the dataviz skill); each column's value shows on hover
 *  or keyboard focus, and the biggest day is labelled directly. */
export function SpendOverTimeChart({
  days,
  totalByDay,
  average,
  currency,
}: {
  /** Every day to plot, "YYYY-MM-DD", in order (including zero-spend days). */
  days: string[];
  totalByDay: Map<string, number>;
  average: number;
  currency: string;
}) {
  const amounts = days.map((d) => totalByDay.get(d) ?? 0);
  const max = Math.max(...amounts, 0.01);
  const peakIndex = amounts.indexOf(Math.max(...amounts));
  // Long trips: label every 7th day (and the last) so labels never collide.
  const labelEvery = days.length > 14 ? 7 : 1;
  const money = (n: number) => formatMoney(n, currency);
  const fmt = (day: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' });

  return (
    <section className="report-card" aria-labelledby="by-day-heading">
      <div className="report-card-head">
        <h3 className="report-heading" id="by-day-heading">
          Spend by day
        </h3>
        <span className="report-legend-line" aria-hidden="true">
          <span className="report-legend-dash" /> average {money(average)}/day
        </span>
      </div>

      <div className="day-chart">
        <span className="day-chart-avg" style={{ '--avg': average / max } as CSSProperties} aria-hidden="true" />
        <ol className="day-chart-cols">
          {days.map((day, i) => {
            const amount = amounts[i];
            const label = `${fmt(day, { weekday: 'long', month: 'short', day: 'numeric' })}: ${amount > 0 ? money(amount) : 'no spending'}`;
            return (
              <li className="day-chart-col" key={day} tabIndex={0}>
                <span className="visually-hidden">{label}</span>
                <span className="day-chart-tip" aria-hidden="true">
                  <strong>{amount > 0 ? money(amount) : 'No spending'}</strong>
                  <span>{fmt(day, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                </span>
                <span className="day-chart-plot" aria-hidden="true">
                  {i === peakIndex && amount > 0 && <span className="day-chart-peak">{money(amount)}</span>}
                  <span
                    className={`day-chart-bar${amount > 0 ? '' : ' empty'}`}
                    style={{ height: amount > 0 ? `max(${(amount / max) * 100}%, 4px)` : undefined }}
                  />
                </span>
                <span className="day-chart-label" aria-hidden="true">
                  {i % labelEvery === 0 || i === days.length - 1 ? (
                    <>
                      <span className="day-chart-weekday">{fmt(day, { weekday: 'short' })}</span>
                      <span>{fmt(day, { day: 'numeric' })}</span>
                    </>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
