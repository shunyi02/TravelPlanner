/** A curated set of expense categories — plain strings (not a DB enum), same
 *  approach as COMMON_CURRENCIES, so adding one later is a frontend-only change. */
export const EXPENSE_CATEGORIES = [
  'Food',
  'Transport',
  'Accommodation',
  'Activities',
  'Shopping',
  'Tickets',
  'Other',
] as const;

export const DEFAULT_EXPENSE_CATEGORY = 'Other';
