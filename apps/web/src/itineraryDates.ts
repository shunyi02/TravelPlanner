// The itinerary's day helpers live in the shared package, so web, mobile and
// the exported itinerary bucket items into days the same way.
export {
  dayDelta,
  dayKeysFor,
  daysBetween,
  formatTime,
  groupByDay,
  hotelDayLabel,
  shiftDay,
  sortTimeForDay,
} from '@travel-planner/shared';
