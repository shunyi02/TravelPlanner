/** A short, curated list for a trip currency picker — not the full ISO 4217
 *  set, just currencies common enough to cover most trips without pulling in
 *  a locale/currency data library. */
export const COMMON_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CNY',
  'AUD',
  'CAD',
  'CHF',
  'HKD',
  'SGD',
  'MYR',
  'THB',
  'IDR',
  'PHP',
  'VND',
  'INR',
  'KRW',
  'NZD',
  'MXN',
  'AED',
] as const;

/** A money amount with its currency code and thousands separators, e.g.
 *  "SGD 1,374.51". Falls back to a plain "SGD 1374.51" for a code Intl
 *  doesn't recognise. */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'code' }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
