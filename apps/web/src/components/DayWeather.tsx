import type { DayForecast } from '../weather';
import { weatherIcon } from '../weather';

/** Inline weather badge for one day. `compact` shows just the icon (for the
 *  day-picker tabs); otherwise icon + high/low in °C. Renders nothing when
 *  there's no forecast (outside Open-Meteo's ~16-day horizon, or the trip
 *  has no destination coordinates yet). */
export function DayWeather({ forecast, compact }: { forecast?: DayForecast; compact?: boolean }) {
  if (!forecast) return null;
  const icon = weatherIcon(forecast.code);
  if (compact) {
    return (
      <span
        className="day-weather-compact"
        title={`${Math.round(forecast.tempMax)}° / ${Math.round(forecast.tempMin)}°C`}
      >
        {icon}
      </span>
    );
  }
  return (
    <span className="day-weather">
      {icon} {Math.round(forecast.tempMax)}° / {Math.round(forecast.tempMin)}°C
    </span>
  );
}
