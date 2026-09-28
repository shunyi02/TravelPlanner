/**
 * The exported itinerary, as one HTML document shared by web and mobile. Web
 * prints it from a hidden iframe (Save as PDF) or captures it as an image;
 * mobile turns it into a PDF file with expo-print. Keeping it a plain string
 * means both apps produce the same pages.
 *
 * Layout: a trip overview (dates, people, at-a-glance numbers, flights, stays
 * and a route map), then one section per day as a timeline whose numbered
 * stops match that day's map. Always light, with the trip theme's accent.
 */
import { dateKey, daysBetween, formatTime, groupByDay, hotelDayLabel } from './itineraryDates';
import { hueForIndex } from './palette';

export interface SheetPlace {
  id: string;
  type: 'STOP' | 'HOTEL' | 'FLIGHT';
  name: string;
  lat: number | null;
  lng: number | null;
  visitDate: string | null;
  notes: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
  departureAirport: string | null;
  arrivalAirport: string | null;
  checkIn: string | null;
  checkOut: string | null;
  address?: string | null;
  confirmationCode?: string | null;
  flightNumber?: string | null;
  /** Empty means the item is for everyone. */
  assignments: Array<{ userId: string }>;
}

export interface SheetTrip {
  name: string;
  startDate: string | null;
  endDate: string | null;
  destinationName: string | null;
  places: SheetPlace[];
}

/** The light palette the sheet is drawn in (the trip theme's light colors). */
export interface SheetPalette {
  surface: string;
  ink: string;
  inkSoft: string;
  rule: string;
  route: string;
  routeSoft: string;
  ledger: string;
}

export type PaperSize = 'A4' | 'Letter';

export interface ItinerarySheetOptions {
  scope: 'trip' | 'day';
  /** The day to export when scope is 'day' ("YYYY-MM-DD"). */
  day?: string;
  /** Export one member's plan; null or omitted for everyone. */
  personId?: string | null;
  include?: { map?: boolean; notes?: boolean; checkboxes?: boolean };
  /** 'print' paginates for paper; 'image' is one tall card for sharing. */
  variant: 'print' | 'image';
  paper?: PaperSize;
  /** Page margins in the document's @page rule. Turn off where the printer sets
   *  them instead (iOS, through expo-print's margins option), or they double. */
  cssPageMargins?: boolean;
  palette: SheetPalette;
  /** Defaults to now; passed in so tests are stable. */
  generatedAt?: Date;
}

export interface ItinerarySheet {
  /** A file-name-safe title, e.g. "Kyoto – Day 3 – Mei". */
  title: string;
  /** Styles, all scoped under `.cuti-sheet`, so the body can also be placed in a page. */
  css: string;
  body: string;
  /** A complete HTML document (css + body + page setup), for printing. */
  document: string;
}

/** US and Canada print on Letter; everywhere else on A4. */
export function paperForLocale(locale: string | undefined): PaperSize {
  return /[-_](US|CA|MX|PH)\b/i.test(locale ?? '') ? 'Letter' : 'A4';
}

/** A file-name-safe version of `name` (keeps spaces, accents and "&"). */
export function fileSafe(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '-').trim();
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function formatDay(day: string, opts: Intl.DateTimeFormatOptions): string {
  return new Date(day + 'T00:00:00Z').toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' });
}

function nights(ci: string, co: string): number {
  return Math.round((Date.parse(dateKey(co) + 'T00:00:00Z') - Date.parse(dateKey(ci) + 'T00:00:00Z')) / 86_400_000);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Phosphor "fill" glyphs (256 × 256), the icon set both apps use.
const ICON_PATHS = {
  plane:
    'M215.52 197.26a8 8 0 0 1-1.86 8.39l-24 24A8 8 0 0 1 184 232a7 7 0 0 1-.79 0 8 8 0 0 1-5.87-3.52l-44.07-66.12L112 183.59V208a8 8 0 0 1-2.34 5.65s-14 14.06-15.88 15.88a7.9 7.9 0 0 1-2.78 1.88 8 8 0 0 1-10.41-4.35l-.06-.15-14.7-36.76L29 175.42a8 8 0 0 1-2.69-13.08l16-16A8 8 0 0 1 48 144h24.4l21.27-21.27-66.11-44.08a8 8 0 0 1-1.22-12.32l24-24a8 8 0 0 1 8.39-1.86l85.94 31.25 31.53-31.53a28 28 0 0 1 39.6 39.6l-31.53 31.53Z',
  bed: 'M216 72H32V48a8 8 0 0 0-16 0v160a8 8 0 0 0 16 0v-32h208v32a8 8 0 0 0 16 0v-96a40 40 0 0 0-40-40M32 88h72v72H32Z',
};
const icon = (name: keyof typeof ICON_PATHS, cls = 'ic') =>
  `<svg class="${cls}" viewBox="0 0 256 256" aria-hidden="true"><path d="${ICON_PATHS[name]}"/></svg>`;

interface MapPoint {
  lat: number;
  lng: number;
  /** Number shown in the dot; null draws a small square (a hotel). */
  label: string | null;
  color: string;
  group: string;
}

/** A route sketch as inline SVG: equirectangular, longitude squeezed by
 *  cos(mean latitude), fitted to the box. No map tiles, so it prints crisply,
 *  works offline and looks the same everywhere. */
function routeSvg(points: MapPoint[], w: number, h: number, palette: SheetPalette): string {
  const pad = 20;
  const meanLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const k = Math.cos((meanLat * Math.PI) / 180);
  const raw = points.map((p) => ({ x: p.lng * k, y: -p.lat }));

  // One far-off stop (a day trip to another city) would shrink everything
  // else into a corner. Fit the frame to the stops near the median, and pull
  // the far ones in to its edge, drawn hollow.
  const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
  const cx = median(raw.map((p) => p.x));
  const cy = median(raw.map((p) => p.y));
  const dist = raw.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const limit = Math.max(median(dist) * 4, 0.02);
  const far = dist.map((d) => raw.length > 3 && d > limit);
  const fit = raw.filter((_, i) => !far[i]);
  const minX = Math.min(...fit.map((p) => p.x));
  const minY = Math.min(...fit.map((p) => p.y));
  const spanX = Math.max(...fit.map((p) => p.x)) - minX;
  const spanY = Math.max(...fit.map((p) => p.y)) - minY;
  const scale = Math.min((w - pad * 2) / (spanX || 1), (h - pad * 2) / (spanY || 1));
  const offX = (w - spanX * scale) / 2;
  const offY = (h - spanY * scale) / 2;
  const clamp = (v: number, max: number) => Math.min(Math.max(v, pad / 2), max - pad / 2);
  const xy = raw.map((p) => ({
    x: clamp(offX + (p.x - minX) * scale, w),
    y: clamp(offY + (p.y - minY) * scale, h),
  }));

  const groups = new Map<string, number[]>();
  points.forEach((p, i) => groups.set(p.group, [...(groups.get(p.group) ?? []), i]));
  const lines = [...groups.values()]
    .filter((idx) => idx.length > 1)
    .map(
      (idx) =>
        `<polyline points="${idx.map((i) => `${xy[i].x.toFixed(1)},${xy[i].y.toFixed(1)}`).join(' ')}" fill="none" stroke="${points[idx[0]].color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>`,
    )
    .join('');
  const dots = points
    .map((p, i) => {
      const { x, y } = xy[i];
      if (p.label === null) {
        return `<rect x="${(x - 5).toFixed(1)}" y="${(y - 5).toFixed(1)}" width="10" height="10" rx="2.5" fill="${palette.surface}" stroke="${p.color}" stroke-width="2"/>`;
      }
      if (far[i]) {
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" fill="${palette.surface}" stroke="${p.color}" stroke-width="2" stroke-dasharray="3 2"/><text x="${x.toFixed(1)}" y="${(y + 3.4).toFixed(1)}" text-anchor="middle" font-size="9.5" font-weight="700" fill="${p.color}">${escapeHtml(p.label)}</text>`;
      }
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="${p.color}" stroke="${palette.surface}" stroke-width="2"/><text x="${x.toFixed(1)}" y="${(y + 3.4).toFixed(1)}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#fff">${escapeHtml(p.label)}</text>`;
    })
    .join('');
  const grid = Array.from({ length: 5 }, (_, i) => {
    const gx = ((i + 1) * w) / 6;
    const gy = ((i + 1) * h) / 6;
    return `<line x1="${gx}" y1="0" x2="${gx}" y2="${h}"/><line x1="0" y1="${gy}" x2="${w}" y2="${gy}"/>`;
  }).join('');
  return `<svg class="map" viewBox="0 0 ${w} ${h}" role="img" aria-label="Route sketch"><rect width="${w}" height="${h}" rx="10" fill="${palette.routeSoft}"/><g stroke="${palette.surface}" stroke-width="1" opacity="0.7">${grid}</g>${lines}${dots}</svg>`;
}

export function renderItinerarySheet(
  trip: SheetTrip,
  memberNames: Record<string, string>,
  options: ItinerarySheetOptions,
): ItinerarySheet {
  const { palette, variant, scope } = options;
  const include = { map: true, notes: true, checkboxes: true, ...options.include };
  const personId = options.personId ?? null;
  const generatedAt = options.generatedAt ?? new Date();
  const wholeTrip = scope === 'trip';
  const firstName = (id: string) => (memberNames[id] ?? '').split(' ')[0];

  const tripDays =
    trip.startDate && trip.endDate ? daysBetween(trip.startDate.slice(0, 10), trip.endDate.slice(0, 10)) : [];
  const days = wholeTrip ? tripDays : options.day ? [options.day] : [];
  const places = personId
    ? trip.places.filter((p) => p.assignments.length === 0 || p.assignments.some((a) => a.userId === personId))
    : trip.places;
  const { byDay, unscheduled } = groupByDay(places, days);
  const dayNumber = (day: string) => tripDays.indexOf(day) + 1;

  const title = fileSafe(
    [
      trip.name,
      !wholeTrip && options.day ? `Day ${dayNumber(options.day) || formatDay(options.day, { day: 'numeric', month: 'short' })}` : 'Itinerary',
      personId ? firstName(personId) : null,
    ]
      .filter(Boolean)
      .join(' – '),
  );

  // Whole trip: every booking. One day: only the flights and stays that day.
  const onShownDays = (p: SheetPlace) => wholeTrip || [...byDay.values()].some((list) => list.includes(p));
  const flights = places
    .filter((p) => p.type === 'FLIGHT' && onShownDays(p))
    .sort((a, b) => Date.parse(a.departureTime ?? '') - Date.parse(b.departureTime ?? ''));
  const hotels = places
    .filter((p) => p.type === 'HOTEL' && onShownDays(p))
    .sort((a, b) => Date.parse(a.checkIn ?? '') - Date.parse(b.checkIn ?? ''));
  const stopCount = places.filter((p) => p.type === 'STOP').length;

  const who = (p: SheetPlace) =>
    !personId && p.assignments.length > 0 ? p.assignments.map((a) => firstName(a.userId)).filter(Boolean).join(', ') : '';

  // ---- Header ----
  const dateLine = [
    tripDays.length
      ? `${formatDay(tripDays[0], { weekday: 'short', day: 'numeric', month: 'short' })} – ${formatDay(tripDays[tripDays.length - 1], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}`
      : null,
    tripDays.length ? plural(tripDays.length, 'day') : null,
    trip.destinationName,
  ]
    .filter(Boolean)
    .join(' · ');
  const peopleLine = personId ? `Plan for ${memberNames[personId] ?? ''}` : Object.values(memberNames).join(' · ');
  const printedOn = generatedAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  const header = `
<header class="head">
  <div class="brand"><span><svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3 30 29H2z"/></svg>Cuti · ${wholeTrip ? 'Itinerary' : 'Day plan'}</span><span>${variant === 'print' ? 'Printed' : 'Shared'} ${escapeHtml(printedOn)}</span></div>
  <h1>${escapeHtml(trip.name)}</h1>
  ${!wholeTrip && options.day ? `<p class="lede">${escapeHtml(`${dayNumber(options.day) ? `Day ${dayNumber(options.day)} · ` : ''}${formatDay(options.day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`)}</p>` : dateLine ? `<p class="lede">${escapeHtml(dateLine)}</p>` : ''}
  <p class="people">${escapeHtml(peopleLine)}</p>
</header>`;

  // ---- Overview (whole trip only) ----
  const glance = wholeTrip
    ? `<dl class="glance">${[
        tripDays.length ? [String(tripDays.length), tripDays.length === 1 ? 'day' : 'days'] : null,
        [String(stopCount), stopCount === 1 ? 'stop' : 'stops'],
        [String(flights.length), flights.length === 1 ? 'flight' : 'flights'],
        [String(hotels.length), hotels.length === 1 ? 'stay' : 'stays'],
      ]
        .filter((x): x is string[] => x !== null)
        .map(([n, label]) => `<div><dt>${n}</dt><dd>${label}</dd></div>`)
        .join('')}</dl>`
    : '';

  const refLine = (p: SheetPlace) =>
    p.confirmationCode ? `<span class="ref">Ref ${escapeHtml(p.confirmationCode)}</span>` : '';

  const flightRows = flights
    .map((f) => {
      const when = f.departureTime ? formatDay(dateKey(f.departureTime), { weekday: 'short', day: 'numeric', month: 'short' }) : '—';
      const times = [formatTime(f.departureTime), formatTime(f.arrivalTime)].filter(Boolean).join(' → ');
      return `<tr><td class="when">${escapeHtml(when)}</td><td><strong>${escapeHtml(`${f.departureAirport ?? '?'} → ${f.arrivalAirport ?? '?'}`)}</strong>${f.flightNumber ? ` <span class="muted">${escapeHtml(f.flightNumber)}</span>` : ''}</td><td class="num">${escapeHtml(times)}</td><td class="right">${refLine(f)}</td></tr>`;
    })
    .join('');
  const hotelRows = hotels
    .map((h) => {
      const range = [h.checkIn, h.checkOut]
        .filter((d): d is string => !!d)
        .map((d) => formatDay(dateKey(d), { weekday: 'short', day: 'numeric', month: 'short' }))
        .join(' → ');
      const n = h.checkIn && h.checkOut ? plural(nights(h.checkIn, h.checkOut), 'night') : '';
      return `<tr><td class="when">${escapeHtml(range || '—')}</td><td><strong>${escapeHtml(h.name)}</strong>${h.address ? `<div class="muted">${escapeHtml(h.address)}</div>` : ''}</td><td class="num">${escapeHtml(n)}</td><td class="right">${refLine(h)}</td></tr>`;
    })
    .join('');
  const bookings =
    flights.length || hotels.length
      ? `<section class="block bookings">
  ${flights.length ? `<h2>${icon('plane')}${wholeTrip ? 'Flights' : 'Flights today'}</h2><table>${flightRows}</table>` : ''}
  ${hotels.length ? `<h2>${icon('bed')}${wholeTrip ? 'Stays' : 'Staying'}</h2><table>${hotelRows}</table>` : ''}
</section>`
      : '';

  // Numbered stops, per day, shared by the timeline and its map.
  const stopNumbers = new Map<string, Map<string, number>>();
  for (const day of days) {
    const numbers = new Map<string, number>();
    (byDay.get(day) ?? []).filter((p) => p.type === 'STOP').forEach((p, i) => numbers.set(p.id, i + 1));
    stopNumbers.set(day, numbers);
  }

  const overviewPoints: MapPoint[] = [];
  days.forEach((day, i) => {
    for (const p of byDay.get(day) ?? []) {
      if (p.type !== 'STOP' || p.lat == null || p.lng == null) continue;
      overviewPoints.push({ lat: p.lat, lng: p.lng, label: String(dayNumber(day) || i + 1), color: hueForIndex(i), group: day });
    }
  });
  const overviewMap =
    wholeTrip && include.map && overviewPoints.length > 1
      ? `<section class="block overview-map"><h2>Route by day</h2>${routeSvg(overviewPoints, 640, 280, palette)}<ul class="legend">${days
          .map((day, i) => ((byDay.get(day) ?? []).some((p) => p.type === 'STOP' && p.lat != null) ? `<li><span style="background:${hueForIndex(i)}"></span>Day ${dayNumber(day) || i + 1}</li>` : ''))
          .join('')}</ul><p class="caption">Each dot is a stop, numbered by its day. Lines join a day's stops in order. A hollow dot is further away than shown.</p></section>`
      : '';

  // ---- Days ----
  const renderItem = (p: SheetPlace, day?: string) => {
    let time = '';
    let marker = '';
    const lines: string[] = [];
    if (p.type === 'FLIGHT') {
      marker = `<span class="marker marker-icon">${icon('plane')}</span>`;
      time = formatTime(p.departureTime);
      const route = `${p.departureAirport ?? '?'} → ${p.arrivalAirport ?? '?'}`;
      lines.push(
        [
          // A flight named after its route already says it.
          p.name === route ? null : route,
          p.arrivalTime ? `lands ${formatTime(p.arrivalTime)}` : null,
          p.flightNumber,
        ]
          .filter(Boolean)
          .map((s) => escapeHtml(s!))
          .join(' · '),
      );
    } else if (p.type === 'HOTEL') {
      marker = `<span class="marker marker-icon">${icon('bed')}</span>`;
      const label = hotelDayLabel(p, day) ?? '';
      const m = /^(Check-(?:in|out)) (.+)$/.exec(label);
      time = m ? m[2] : '';
      if (m ? m[1] : label) lines.push(escapeHtml(m ? m[1] : label));
      if (p.address && (!day || m)) lines.push(escapeHtml(p.address));
    } else {
      const n = day ? stopNumbers.get(day)?.get(p.id) : undefined;
      marker = `<span class="marker">${n ?? '•'}</span>`;
      time = formatTime(p.visitDate);
      if (p.address) lines.push(escapeHtml(p.address));
      if (include.notes && p.notes) lines.push(`<span class="note">${escapeHtml(p.notes)}</span>`);
    }
    if (p.confirmationCode && (p.type === 'FLIGHT' || !day || /^Check-in/.test(hotelDayLabel(p, day) ?? ''))) {
      lines.push(refLine(p));
    }
    const going = who(p);
    const check = variant === 'print' && include.checkboxes && p.type === 'STOP' ? '<span class="check"></span>' : '';
    return `<li class="item item-${p.type.toLowerCase()}">
  <span class="time">${escapeHtml(time)}</span>${marker}
  <div class="what"><div class="name">${escapeHtml(p.name)}${going ? `<span class="who">${escapeHtml(going)}</span>` : ''}</div>${lines
    .filter(Boolean)
    .map((l) => `<div class="sub">${l}</div>`)
    .join('')}</div>${check}
</li>`;
  };

  const daySections = days
    .map((day) => {
      // Mid-stay hotel rows ("Staying") say the same thing every day: one line
      // under the day's heading instead. Check-in and check-out stay in the list.
      const all = byDay.get(day) ?? [];
      const staying = all.filter((p) => p.type === 'HOTEL' && hotelDayLabel(p, day) === 'Staying');
      const items = all.filter((p) => !staying.includes(p));
      const n = dayNumber(day);
      // The accent, not the day's hue: it matches the numbered dots in the list
      // and reads on white, which the palette's yellow doesn't with white text.
      const color = palette.route;
      const points: MapPoint[] = items
        .filter((p) => p.type !== 'FLIGHT' && p.lat != null && p.lng != null)
        .map((p) => ({
          lat: p.lat!,
          lng: p.lng!,
          label: p.type === 'STOP' ? String(stopNumbers.get(day)?.get(p.id) ?? '') : null,
          color,
          group: day,
        }));
      const map = include.map && points.filter((p) => p.label).length > 1 ? routeSvg(points, 250, 190, palette) : '';
      return `<section class="day${wholeTrip ? '' : ' single'}">
  <header class="day-head"><span class="day-no">${n > 0 ? `Day ${n}` : formatDay(day, { weekday: 'short' })}</span><h2>${escapeHtml(formatDay(day, { weekday: 'long', day: 'numeric', month: 'long' }))}</h2>${
    staying.length ? `<span class="staying">${icon('bed')}Staying at ${escapeHtml(staying.map((h) => h.name).join(' & '))}</span>` : ''
  }</header>
  <div class="day-body${map ? ' with-map' : ''}">
    ${items.length ? `<ol class="timeline">${items.map((p) => renderItem(p, day)).join('')}</ol>` : `<p class="free">${staying.length ? 'Free day.' : 'Free day. Nothing planned yet.'}</p>`}
    ${map ? `<div class="day-map">${map}</div>` : ''}
  </div>
</section>`;
    })
    .join('');

  const unscheduledSection =
    wholeTrip && unscheduled.length
      ? `<section class="day"><header class="day-head"><h2>Not yet scheduled</h2></header><ol class="timeline">${unscheduled.map((p) => renderItem(p)).join('')}</ol></section>`
      : '';

  const body = `<article class="cuti-sheet sheet-${variant}">
${header}
${glance}
${bookings}
${overviewMap}
<div class="days${wholeTrip && (bookings || overviewMap) ? ' days-new-page' : ''}">${daySections}${unscheduledSection}</div>
<footer class="foot"><span>${escapeHtml(trip.name)}</span><span>Made with Cuti</span></footer>
</article>`;

  const css = sheetCss(palette);
  const paper = options.paper ?? 'A4';
  const document = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><style>
@page { size: ${paper}; margin: ${options.cssPageMargins === false ? '0' : '14mm 14mm 16mm'}; @bottom-right { content: counter(page) " / " counter(pages); font: 8pt -apple-system, "Segoe UI", Roboto, sans-serif; color: ${palette.inkSoft}; } }
html, body { margin: 0; background: #fff; }
${css}
</style></head><body>${body}</body></html>`;

  return { title, css, body, document };
}

function sheetCss(c: SheetPalette): string {
  return `
.cuti-sheet { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter Variable", "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: ${c.ink}; background: ${c.surface}; font-size: 10.5pt; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-variant-numeric: tabular-nums; }
.cuti-sheet *, .cuti-sheet *::before, .cuti-sheet *::after { box-sizing: border-box; }
.cuti-sheet.sheet-image { width: 600px; padding: 36px 34px 28px; font-size: 13px; }
.cuti-sheet h1, .cuti-sheet h2, .cuti-sheet p, .cuti-sheet ol, .cuti-sheet dl, .cuti-sheet dd { margin: 0; padding: 0; }
.cuti-sheet .ic { width: 1em; height: 1em; fill: currentColor; vertical-align: -0.12em; }
.cuti-sheet .muted { color: ${c.inkSoft}; font-weight: 400; }

.cuti-sheet .head { padding-bottom: 14px; border-bottom: 2px solid ${c.route}; }
.cuti-sheet .brand { display: flex; justify-content: space-between; align-items: center; font-size: 8pt; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${c.inkSoft}; margin-bottom: 14px; }
.cuti-sheet .brand > span:first-child { display: flex; align-items: center; gap: 6px; color: ${c.route}; }
.cuti-sheet .logo { width: 12px; height: 12px; fill: ${c.route}; }
.cuti-sheet h1 { font-size: 28pt; line-height: 1.08; font-weight: 700; letter-spacing: -0.02em; text-wrap: balance; }
.cuti-sheet .lede { margin-top: 6px; font-size: 11.5pt; font-weight: 500; }
.cuti-sheet .people { margin-top: 3px; color: ${c.inkSoft}; }

.cuti-sheet .glance { display: flex; gap: 0; margin: 16px 0 4px; border: 1px solid ${c.rule}; border-radius: 10px; overflow: hidden; }
.cuti-sheet .glance div { flex: 1; padding: 9px 12px; border-left: 1px solid ${c.rule}; }
.cuti-sheet .glance div:first-child { border-left: 0; }
.cuti-sheet .glance dt { font-size: 16pt; font-weight: 700; letter-spacing: -0.01em; }
.cuti-sheet .glance dd { font-size: 8.5pt; color: ${c.inkSoft}; }

.cuti-sheet .block { margin-top: 18px; break-inside: avoid; }
.cuti-sheet .block h2, .cuti-sheet .day-head h2 { font-size: 12pt; font-weight: 700; letter-spacing: -0.01em; }
.cuti-sheet .bookings h2 { display: flex; align-items: center; gap: 6px; margin: 14px 0 6px; color: ${c.route}; font-size: 9pt; letter-spacing: 0.06em; text-transform: uppercase; }
.cuti-sheet .bookings h2:first-child { margin-top: 0; }
.cuti-sheet table { width: 100%; border-collapse: collapse; }
.cuti-sheet td { padding: 7px 8px 7px 0; border-top: 1px solid ${c.rule}; vertical-align: top; }
.cuti-sheet tr:first-child td { border-top: 0; }
.cuti-sheet td.when { width: 30%; color: ${c.inkSoft}; white-space: nowrap; }
.cuti-sheet td.num { white-space: nowrap; }
.cuti-sheet td.right { text-align: right; padding-right: 0; white-space: nowrap; }
.cuti-sheet .ref { display: inline-block; padding: 1px 6px; border-radius: 4px; background: ${c.routeSoft}; color: ${c.route}; font-size: 8.5pt; font-weight: 600; letter-spacing: 0.02em; }
.cuti-sheet .overview-map .map { display: block; width: 100%; height: auto; margin-top: 8px; }
.cuti-sheet .legend { display: flex; flex-wrap: wrap; gap: 4px 14px; list-style: none; margin: 8px 0 0; padding: 0; font-size: 8.5pt; color: ${c.inkSoft}; }
.cuti-sheet .legend li { display: flex; align-items: center; gap: 5px; }
.cuti-sheet .legend span { width: 9px; height: 9px; border-radius: 50%; }
.cuti-sheet .caption { margin-top: 5px; font-size: 8.5pt; color: ${c.inkSoft}; }

.cuti-sheet .days-new-page { break-before: page; }
.cuti-sheet.sheet-image .days-new-page { break-before: auto; margin-top: 22px; }
.cuti-sheet .day { padding-top: 14px; margin-top: 14px; border-top: 1px solid ${c.rule}; }
.cuti-sheet .days > .day:first-child { border-top: 0; margin-top: 0; }
.cuti-sheet .day.single { border-top: 0; margin-top: 8px; }
.cuti-sheet .day-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 8px; break-after: avoid; }
.cuti-sheet .staying { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; font-size: 8.5pt; color: ${c.inkSoft}; }
.cuti-sheet .staying .ic { color: ${c.route}; }
.cuti-sheet .day-no { font-size: 8.5pt; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: ${c.route}; }
.cuti-sheet .day-body.with-map { display: grid; grid-template-columns: 1fr 190px; gap: 18px; align-items: start; }
.cuti-sheet.sheet-image .day-body.with-map { grid-template-columns: 1fr 170px; }
.cuti-sheet .day-map .map { display: block; width: 100%; height: auto; }
.cuti-sheet .free { color: ${c.inkSoft}; font-style: italic; }

.cuti-sheet .timeline { list-style: none; position: relative; }
.cuti-sheet .timeline::before { content: ""; position: absolute; left: 67px; top: 10px; bottom: 10px; width: 1.5px; background: ${c.rule}; }
.cuti-sheet .item { display: grid; grid-template-columns: 56px 22px 1fr auto; column-gap: 8px; align-items: start; padding: 5px 0; break-inside: avoid; }
.cuti-sheet .time { padding-top: 2px; text-align: right; font-size: 9.5pt; font-weight: 600; color: ${c.inkSoft}; white-space: nowrap; }
.cuti-sheet .marker { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; background: ${c.route}; color: #fff; font-size: 8.5pt; font-weight: 700; }
.cuti-sheet .marker-icon { border-radius: 6px; background: ${c.routeSoft}; color: ${c.route}; }
.cuti-sheet .marker-icon .ic { width: 12px; height: 12px; }
.cuti-sheet .name { font-weight: 600; padding-top: 1px; }
.cuti-sheet .who { margin-left: 6px; padding: 0 6px; border-radius: 4px; background: ${c.routeSoft}; color: ${c.route}; font-size: 8pt; font-weight: 600; }
.cuti-sheet .sub { color: ${c.inkSoft}; font-size: 9.5pt; }
.cuti-sheet .note { color: ${c.ink}; }
.cuti-sheet .sub .ref { margin-top: 2px; }
.cuti-sheet .check { width: 12px; height: 12px; margin-top: 4px; border: 1.5px solid ${c.inkSoft}; border-radius: 3px; }

.cuti-sheet .foot { display: flex; justify-content: space-between; margin-top: 22px; padding-top: 8px; border-top: 1px solid ${c.rule}; font-size: 8pt; color: ${c.inkSoft}; }
`;
}
