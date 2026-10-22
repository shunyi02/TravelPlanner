import { dayDelta, daysBetween, groupByDay, shiftDay, DatedPlace } from './itineraryDates';

const none = { visitDate: null, departureTime: null, checkIn: null, checkOut: null };
const stop = (visitDate: string | null): DatedPlace => ({ ...none, type: 'STOP', visitDate });
const hotel = (checkIn: string | null, checkOut: string | null): DatedPlace => ({
  ...none,
  type: 'HOTEL',
  checkIn,
  checkOut,
});

// Local-time ISO strings (no zone) so the local calendar day is the same on any machine.
describe('daysBetween', () => {
  it('returns one day when start and end are the same', () => {
    expect(daysBetween('2026-03-05', '2026-03-05')).toEqual(['2026-03-05']);
  });

  it('lists every day of a multi-day range, inclusive', () => {
    expect(daysBetween('2026-03-05', '2026-03-08')).toEqual([
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
    ]);
  });

  it('crosses a month boundary', () => {
    expect(daysBetween('2026-01-30', '2026-02-02')).toEqual([
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
    ]);
  });

  it('returns nothing when end is before start', () => {
    expect(daysBetween('2026-03-08', '2026-03-05')).toEqual([]);
  });
});

describe('shiftDay', () => {
  it('moves forward and back by whole days', () => {
    expect(shiftDay('2026-03-05', 3)).toBe('2026-03-08');
    expect(shiftDay('2026-03-05', 0)).toBe('2026-03-05');
  });

  it('handles a negative delta across a month boundary', () => {
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('handles a negative delta across a year boundary', () => {
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('handles a positive delta across a year boundary', () => {
    expect(shiftDay('2025-12-31', 2)).toBe('2026-01-02');
  });
});

describe('dayDelta', () => {
  it('is 0 for the same day', () => {
    expect(dayDelta('2026-03-05', '2026-03-05')).toBe(0);
  });

  it('is positive going forward and negative going back', () => {
    expect(dayDelta('2026-03-05', '2026-03-09')).toBe(4);
    expect(dayDelta('2026-03-09', '2026-03-05')).toBe(-4);
  });

  it('counts across month and year boundaries', () => {
    expect(dayDelta('2026-02-27', '2026-03-02')).toBe(3);
    expect(dayDelta('2025-12-30', '2026-01-02')).toBe(3);
  });

  it('is the inverse of shiftDay', () => {
    expect(dayDelta('2026-03-05', shiftDay('2026-03-05', -17))).toBe(-17);
  });
});

describe('groupByDay', () => {
  const days = ['2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08'];

  it('puts a multi-night hotel on every day from check-in to check-out', () => {
    const h = hotel('2026-03-05T15:00:00', '2026-03-08T11:00:00');
    const { byDay, unscheduled } = groupByDay([h], days);
    expect([...byDay.keys()]).toEqual(days);
    for (const day of days) expect(byDay.get(day)).toEqual([h]);
    expect(unscheduled).toEqual([]);
  });

  it('puts a stop on its own day only', () => {
    const s = stop('2026-03-06T10:00:00');
    const { byDay } = groupByDay([s], days);
    expect([...byDay.keys()]).toEqual(['2026-03-06']);
  });

  it('sorts a day by time, with checkout before a same-day check-in', () => {
    const lunch = stop('2026-03-08T12:30:00');
    const checkIn = hotel('2026-03-08T15:00:00', null);
    const checkOut = hotel('2026-03-05T15:00:00', '2026-03-08T11:00:00');
    const { byDay } = groupByDay([checkIn, lunch, checkOut], days);
    expect(byDay.get('2026-03-08')).toEqual([checkOut, lunch, checkIn]);
  });

  it('sends places without a date, or outside the days, to unscheduled', () => {
    const undated = stop(null);
    const outside = stop('2026-04-01T09:00:00');
    const { byDay, unscheduled } = groupByDay([undated, outside], days);
    expect(byDay.size).toBe(0);
    expect(unscheduled).toEqual([undated, outside]);
  });

  it('only shows the days of a hotel stay that are inside the trip days', () => {
    const h = hotel('2026-03-07T15:00:00', '2026-03-10T11:00:00');
    const { byDay } = groupByDay([h], days);
    expect([...byDay.keys()]).toEqual(['2026-03-07', '2026-03-08']);
  });
});
