/** Daily forecast for one "YYYY-MM-DD" day, from Open-Meteo's free,
 *  no-API-key forecast endpoint (https://open-meteo.com/). */
export interface DayForecast {
  tempMax: number;
  tempMin: number;
  code: number;
}

/** Open-Meteo's free forecast endpoint only covers roughly today through the
 *  next 15 days — requesting outside that window errors instead of just
 *  returning nothing, so callers must clamp their range to this first. */
const FORECAST_HORIZON_DAYS = 15;

function toDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Fetches daily forecasts for every day in [startDay, endDay] that falls
 *  within Open-Meteo's ~16-day forecast horizon. Days outside that window
 *  (too far in the future, or in the past) are simply absent from the
 *  result — there's no way to show real forecast weather for them yet. */
export async function fetchWeather(
  lat: number,
  lng: number,
  startDay: string,
  endDay: string,
): Promise<Map<string, DayForecast>> {
  const today = new Date();
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + FORECAST_HORIZON_DAYS);

  const rangeStart = startDay < toDayKey(today) ? toDayKey(today) : startDay;
  const rangeEnd = endDay > toDayKey(horizon) ? toDayKey(horizon) : endDay;
  if (rangeStart > rangeEnd) return new Map();

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&start_date=${rangeStart}&end_date=${rangeEnd}`;

  const res = await fetch(url);
  if (!res.ok) return new Map();
  const data = await res.json();

  const days: string[] = data?.daily?.time ?? [];
  const maxes: number[] = data?.daily?.temperature_2m_max ?? [];
  const mins: number[] = data?.daily?.temperature_2m_min ?? [];
  const codes: number[] = data?.daily?.weathercode ?? [];

  const result = new Map<string, DayForecast>();
  days.forEach((day, i) => {
    if (maxes[i] == null || mins[i] == null || codes[i] == null) return;
    result.set(day, { tempMax: maxes[i], tempMin: mins[i], code: codes[i] });
  });
  return result;
}

/** WMO weather codes, grouped to the icon+label a traveler actually needs —
 *  not the full 27-code table. */
export function weatherIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 57) return '🌦️';
  if (code >= 61 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '🌨️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code >= 85 && code <= 86) return '🌨️';
  if (code >= 95) return '⛈️';
  return '🌡️';
}
