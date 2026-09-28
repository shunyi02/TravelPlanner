import { paperForLocale, renderItinerarySheet, type SheetPalette, type SheetPlace, type SheetTrip } from './itinerarySheet';

const palette: SheetPalette = {
  surface: '#ffffff',
  ink: '#1d1d1f',
  inkSoft: '#6e6e73',
  rule: '#e5e5ea',
  route: '#177b4a',
  routeSoft: '#e3f6ec',
  ledger: '#9a5e17',
};

function place(overrides: Partial<SheetPlace>): SheetPlace {
  return {
    id: 'p',
    type: 'STOP',
    name: 'Somewhere',
    lat: null,
    lng: null,
    visitDate: null,
    notes: null,
    departureTime: null,
    arrivalTime: null,
    departureAirport: null,
    arrivalAirport: null,
    checkIn: null,
    checkOut: null,
    assignments: [],
    ...overrides,
  };
}

// Local-time timestamps, so the day buckets don't depend on the test machine's zone.
const at = (day: string, time: string) => new Date(`${day}T${time}:00`).toISOString();

const trip: SheetTrip = {
  name: 'Kyoto <autumn>',
  startDate: '2026-11-02',
  endDate: '2026-11-04',
  destinationName: 'Kyoto',
  places: [
    place({ id: 'a', name: 'Fushimi Inari', visitDate: at('2026-11-02', '08:00'), lat: 34.967, lng: 135.772 }),
    place({ id: 'b', name: 'Tofuku-ji', visitDate: at('2026-11-02', '11:00'), lat: 34.976, lng: 135.773, assignments: [{ userId: 'u2' }] }),
    place({
      id: 'h',
      type: 'HOTEL',
      name: 'Hotel Kanra',
      checkIn: at('2026-11-02', '15:00'),
      checkOut: at('2026-11-04', '11:00'),
      address: '185 Kitamachi, Shimogyo',
      confirmationCode: 'KNR-4471',
    }),
    place({
      id: 'f',
      type: 'FLIGHT',
      name: 'Home',
      departureTime: at('2026-11-04', '16:40'),
      departureAirport: 'KIX',
      arrivalAirport: 'SIN',
      flightNumber: 'SQ 619',
    }),
    place({ id: 'u', name: 'Somewhere later' }),
  ],
};
const members = { u1: 'Mei Tanaka', u2: 'Arjun Rao' };

describe('renderItinerarySheet', () => {
  it('escapes user text so it stays text', () => {
    const { body, title } = renderItinerarySheet(trip, members, { scope: 'trip', variant: 'print', palette });
    expect(body).toContain('Kyoto &lt;autumn&gt;');
    expect(body).not.toContain('<autumn>');
    expect(title).toBe('Kyoto -autumn- – Itinerary');
  });

  it('shows the overview, bookings with their references, and unscheduled items for the whole trip', () => {
    const { body } = renderItinerarySheet(trip, members, { scope: 'trip', variant: 'print', palette });
    expect(body).toContain('class="glance"');
    expect(body).toContain('SQ 619');
    expect(body).toContain('Ref KNR-4471');
    expect(body).toContain('185 Kitamachi, Shimogyo');
    expect(body).toContain('Not yet scheduled');
    expect(body).toContain('Somewhere later');
  });

  it('numbers stops per day and draws that day\'s map with the same numbers', () => {
    const { body } = renderItinerarySheet(trip, members, { scope: 'day', day: '2026-11-02', variant: 'print', palette });
    expect(body).toMatch(/<span class="marker">1<\/span>[\s\S]*Fushimi Inari/);
    expect(body).toMatch(/<span class="marker">2<\/span>[\s\S]*Tofuku-ji/);
    expect(body).toContain('class="map"');
    expect(body).not.toContain('Not yet scheduled');
  });

  it("filters to one person's plan and names the file after them", () => {
    const { body, title } = renderItinerarySheet(trip, members, {
      scope: 'day',
      day: '2026-11-02',
      personId: 'u1',
      variant: 'print',
      palette,
    });
    expect(body).toContain('Plan for Mei Tanaka');
    expect(body).not.toContain('Tofuku-ji');
    expect(title).toBe('Kyoto -autumn- – Day 1 – Mei');
  });

  it('leaves out maps, notes and tick boxes when asked', () => {
    const withNote = { ...trip, places: [place({ id: 'n', name: 'Nishiki', visitDate: at('2026-11-02', '09:00'), notes: 'Try the tamagoyaki' })] };
    const off = renderItinerarySheet(withNote, members, {
      scope: 'trip',
      variant: 'print',
      palette,
      include: { map: false, notes: false, checkboxes: false },
    }).body;
    expect(off).not.toContain('tamagoyaki');
    expect(off).not.toContain('class="check"');
    const on = renderItinerarySheet(withNote, members, { scope: 'trip', variant: 'print', palette }).body;
    expect(on).toContain('tamagoyaki');
    expect(on).toContain('class="check"');
  });

  it('puts a mid-stay hotel under the day heading instead of in the list', () => {
    const { body } = renderItinerarySheet(trip, members, { scope: 'day', day: '2026-11-03', variant: 'print', palette });
    expect(body).toContain('Staying at Hotel Kanra');
    expect(body).not.toContain('class="item item-hotel"');
    const checkIn = renderItinerarySheet(trip, members, { scope: 'day', day: '2026-11-02', variant: 'print', palette }).body;
    expect(checkIn).toContain('class="item item-hotel"');
  });

  it('builds a full document with the paper size', () => {
    const { document } = renderItinerarySheet(trip, members, { scope: 'trip', variant: 'print', palette, paper: 'Letter' });
    expect(document.startsWith('<!doctype html>')).toBe(true);
    expect(document).toContain('size: Letter');
  });
});

describe('paperForLocale', () => {
  it('uses Letter for the US and Canada and A4 elsewhere', () => {
    expect(paperForLocale('en-US')).toBe('Letter');
    expect(paperForLocale('fr-CA')).toBe('Letter');
    expect(paperForLocale('en-GB')).toBe('A4');
    expect(paperForLocale('zh-SG')).toBe('A4');
    expect(paperForLocale(undefined)).toBe('A4');
  });
});
