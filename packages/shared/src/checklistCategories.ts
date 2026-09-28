/** Sections of a trip's packing checklist, in display order — plain strings
 *  (not a DB enum), same approach as EXPENSE_CATEGORIES. */
export const CHECKLIST_CATEGORIES = [
  'Documents',
  'Clothing',
  'Toiletries',
  'Electronics',
  'Health',
  'Shared gear',
  'Other',
] as const;

export const DEFAULT_CHECKLIST_CATEGORY = 'Other';

/** One-tap suggestions offered while a trip's checklist is empty. */
export const CHECKLIST_STARTERS: ReadonlyArray<{ label: string; category: (typeof CHECKLIST_CATEGORIES)[number] }> = [
  { label: 'Passport', category: 'Documents' },
  { label: 'Travel insurance', category: 'Documents' },
  { label: 'Phone charger', category: 'Electronics' },
  { label: 'Plug adapter', category: 'Electronics' },
  { label: 'Toiletries', category: 'Toiletries' },
  { label: 'Medication', category: 'Health' },
  { label: 'Comfortable shoes', category: 'Clothing' },
  { label: 'Rain jacket', category: 'Clothing' },
];
