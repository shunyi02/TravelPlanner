import { useEffect, useRef, useState } from 'react';
import { CaretLeft, CaretRight, Warning } from '@phosphor-icons/react';
import type { TripDetail } from '../api';
import { api } from '../api';
import { dayDelta, dayKeysFor, daysBetween, shiftDay } from '../itineraryDates';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function todayKey(): string {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local
}

/** "2026-11-01" for any day in November 2026. */
function monthOf(day: string): string {
  return day.slice(0, 8) + '01';
}

function addMonths(month: string, n: number): string {
  const d = new Date(month + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

function formatDay(day: string, opts: Intl.DateTimeFormatOptions): string {
  return new Date(day + 'T00:00:00Z').toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' });
}

/** The month's days laid out Monday-first, with nulls padding the first week. */
function monthGrid(month: string): Array<string | null> {
  const first = new Date(month + 'T00:00:00Z');
  const lead = (first.getUTCDay() + 6) % 7;
  const next = addMonths(month, 1);
  const days = daysBetween(month, shiftDay(next, -1));
  return [...Array<null>(lead).fill(null), ...days];
}

function useIsWide(): boolean {
  const query = '(min-width: 640px)';
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return wide;
}

/** The trip-dates popover opened from the trip header: a range calendar,
 *  a preview of what changes, a warning for itinerary items that would fall
 *  outside the new dates, and an option to move the whole itinerary along
 *  with a new start date (done server-side, in one transaction). */
export function TripDatesEditor({
  trip,
  onClose,
  onSaved,
}: {
  trip: TripDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const origStart = trip.startDate?.slice(0, 10) ?? '';
  const origEnd = trip.endDate?.slice(0, 10) ?? '';
  const today = todayKey();

  const [start, setStart] = useState(origStart);
  const [end, setEnd] = useState(origEnd);
  const [hover, setHover] = useState<string | null>(null);
  const [focused, setFocused] = useState(origStart || today);
  const [viewMonth, setViewMonth] = useState(monthOf(origStart || today));
  const [move, setMove] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false);
  const wide = useIsWide();
  const monthsShown = wide ? 2 : 1;
  const months = Array.from({ length: monthsShown }, (_, i) => addMonths(viewMonth, i));

  // Open: bring the popover into view and put focus on the calendar.
  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    gridRef.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus();
  }, []);

  // Keyboard navigation moves focus to the newly focused day.
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`button[data-day="${focused}"]`)?.focus();
  }, [focused, viewMonth]);

  // Escape or a click outside closes without saving.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  const pick = (day: string) => {
    setError(null);
    if (!start || end) {
      setStart(day);
      setEnd('');
    } else if (day < start) {
      setStart(day);
    } else {
      setEnd(day);
    }
    setFocused(day);
  };

  const focusDay = (day: string) => {
    moveFocus.current = true;
    setFocused(day);
    const last = addMonths(viewMonth, monthsShown - 1);
    if (day < viewMonth) setViewMonth(monthOf(day));
    else if (monthOf(day) > last) setViewMonth(addMonths(monthOf(day), 1 - monthsShown));
  };

  const onDayKey = (e: React.KeyboardEvent, day: string) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in steps) {
      e.preventDefault();
      focusDay(shiftDay(day, steps[e.key]));
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      const d = new Date(day + 'T00:00:00Z');
      d.setUTCMonth(d.getUTCMonth() + (e.key === 'PageUp' ? -1 : 1));
      focusDay(d.toISOString().slice(0, 10));
    }
  };

  // What the change means for the itinerary.
  const complete = Boolean(start && end);
  const delta = origStart && start ? dayDelta(origStart, start) : 0;
  const datedPlaces = trip.places.filter((p) => dayKeysFor(p).length > 0);
  const canMove = delta !== 0 && datedPlaces.length > 0;
  const shiftBy = canMove && move ? delta : 0;
  // Same rule as the itinerary: an item with no day inside the trip goes to
  // "Unscheduled"; a stay that only partly overlaps shows on the days it does.
  const inTrip = (k: string) => {
    const d = shiftDay(k, shiftBy);
    return d >= start && d <= end;
  };
  // Only warn about what this change moves out; items already outside the
  // current dates are already under "Unscheduled".
  const inOriginal = (k: string) => Boolean(origStart && origEnd && k >= origStart && k <= origEnd);
  const unscheduled = complete
    ? datedPlaces.filter((p) => (!origStart || dayKeysFor(p).some(inOriginal)) && !dayKeysFor(p).some(inTrip))
    : [];
  const cutShort = complete
    ? datedPlaces.filter((p) => dayKeysFor(p).some(inTrip) && !dayKeysFor(p).every(inTrip))
    : [];
  const newDays = complete ? daysBetween(start, end).length : 0;
  const oldDays = origStart && origEnd ? daysBetween(origStart, origEnd).length : 0;
  const unchanged = start === origStart && end === origEnd;
  const previewEnd = start && !end && hover && hover >= start ? hover : end;

  const handleSave = async () => {
    if (!complete) return;
    setSaving(true);
    setError(null);
    try {
      await api.updateTrip(trip.id, {
        startDate: start,
        endDate: end,
        ...(shiftBy ? { shiftItineraryDays: shiftBy } : {}),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the new dates');
      setSaving(false);
    }
  };

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  return (
    <>
      <div className="trip-dates-backdrop" aria-hidden="true" />
      <div className="trip-dates" ref={rootRef} role="dialog" aria-labelledby="trip-dates-title">
        <div className="trip-dates-head">
          <h2 className="trip-dates-title" id="trip-dates-title">
            Trip dates
          </h2>
          <p className="trip-dates-hint">
            {!start ? 'Pick the first day.' : !end ? 'Now pick the last day.' : 'Click a day to start over.'}
          </p>
        </div>

        <div className="trip-dates-calendar" ref={gridRef} onMouseLeave={() => setHover(null)}>
          <button
            type="button"
            className="trip-dates-nav trip-dates-nav-prev"
            aria-label="Previous month"
            onClick={() => setViewMonth(addMonths(viewMonth, -1))}
          >
            <CaretLeft size={16} aria-hidden />
          </button>
          <button
            type="button"
            className="trip-dates-nav trip-dates-nav-next"
            aria-label="Next month"
            onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          >
            <CaretRight size={16} aria-hidden />
          </button>

          <div className="trip-dates-months">
            {months.map((month) => (
              <div className="trip-dates-month" key={month}>
                <p className="trip-dates-month-name">{formatDay(month, { month: 'long', year: 'numeric' })}</p>
                <div className="trip-dates-grid">
                  {WEEKDAYS.map((w) => (
                    <span className="trip-dates-weekday" key={w} aria-hidden="true">
                      {w}
                    </span>
                  ))}
                  {monthGrid(month).map((day, i) => {
                    if (!day) return <span key={`pad-${i}`} />;
                    const isStart = day === start;
                    const isEnd = day === (previewEnd || '');
                    const inRange = Boolean(start && previewEnd && day > start && day < previewEnd);
                    const cls = [
                      'trip-dates-day',
                      inRange && 'in-range',
                      isStart && 'range-start',
                      isEnd && 'range-end',
                      isStart && previewEnd && previewEnd !== start && 'has-end',
                      !end && previewEnd && (inRange || isEnd) && 'preview',
                      day === today && 'today',
                    ]
                      .filter(Boolean)
                      .join(' ');
                    const state = isStart ? ', start date' : day === end ? ', end date' : inRange ? ', in trip' : '';
                    return (
                      <button
                        type="button"
                        key={day}
                        data-day={day}
                        className={cls}
                        tabIndex={day === focused ? 0 : -1}
                        aria-label={`${formatDay(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${state}`}
                        aria-pressed={isStart || day === end}
                        onClick={() => pick(day)}
                        onMouseEnter={() => setHover(day)}
                        onKeyDown={(e) => onDayKey(e, day)}
                        onFocus={() => setFocused(day)}
                      >
                        {Number(day.slice(8))}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="trip-dates-summary" aria-live="polite">
          {complete ? (
            <>
              <span className="trip-dates-range">
                {formatDay(start, { weekday: 'short', day: 'numeric', month: 'short' })} →{' '}
                {formatDay(end, { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
              <span className="trip-dates-count">
                {oldDays && newDays !== oldDays ? `${plural(oldDays, 'day')} → ${plural(newDays, 'day')}` : plural(newDays, 'day')}
              </span>
            </>
          ) : (
            <span className="trip-dates-count">{start ? `Starts ${formatDay(start, { weekday: 'short', day: 'numeric', month: 'short' })}` : 'No dates picked'}</span>
          )}
        </div>

        {canMove && complete && (
          <label className="trip-dates-move">
            <input type="checkbox" checked={move} onChange={(e) => setMove(e.target.checked)} />
            <span>
              <strong>Move the itinerary with the new start date</strong>
              <span className="trip-dates-move-sub">
                Shifts {plural(datedPlaces.length, 'dated item')} {delta > 0 ? 'later' : 'earlier'} by {plural(Math.abs(delta), 'day')}, keeping their times.
              </span>
            </span>
          </label>
        )}

        {unscheduled.length > 0 && (
          <p className="trip-dates-warning">
            <Warning size={16} weight="fill" aria-hidden />
            <span>
              {plural(unscheduled.length, 'item')} would fall outside these dates and move to Unscheduled:{' '}
              {unscheduled
                .slice(0, 3)
                .map((p) => p.name)
                .join(', ')}
              {unscheduled.length > 3 ? ` and ${unscheduled.length - 3} more` : ''}.
            </span>
          </p>
        )}
        {cutShort.length > 0 && (
          <p className="trip-dates-warning">
            <Warning size={16} weight="fill" aria-hidden />
            <span>
              {cutShort.map((p) => p.name).join(', ')} {cutShort.length === 1 ? 'runs' : 'run'} past these dates and
              will only show on the days that overlap.
            </span>
          </p>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="trip-dates-actions">
          <button type="button" className="text-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={handleSave} disabled={!complete || unchanged || saving}>
            {saving ? 'Saving…' : 'Save dates'}
          </button>
        </div>
      </div>
    </>
  );
}
