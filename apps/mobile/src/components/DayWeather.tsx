import { Text } from 'react-native';
import type { DayForecast } from '../weather';
import { weatherIcon } from '../weather';
import { useTheme } from '../theme';

export function DayWeather({ forecast, compact }: { forecast?: DayForecast; compact?: boolean }) {
  const colors = useTheme();
  if (!forecast) return null;
  const icon = weatherIcon(forecast.code);
  const tempMax = Math.round(forecast.tempMax);
  const tempMin = Math.round(forecast.tempMin);

  if (compact) {
    return <Text style={{ fontSize: 13 }}>{icon}</Text>;
  }

  return (
    <Text style={{ fontSize: 13, color: colors.inkSoft }}>
      {icon} {tempMax}° / {tempMin}°C
    </Text>
  );
}
