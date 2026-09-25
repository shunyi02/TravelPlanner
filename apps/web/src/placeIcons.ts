import { AirplaneTilt, Bed, MapPin, type Icon } from '@phosphor-icons/react';
import type { PlaceType } from './api';

/** One glyph per itinerary item type, shared by every place that labels one. */
export const PLACE_ICONS: Record<PlaceType, Icon> = {
  STOP: MapPin,
  HOTEL: Bed,
  FLIGHT: AirplaneTilt,
};
