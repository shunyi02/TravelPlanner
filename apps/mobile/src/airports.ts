import raw from './airports.json';

export interface Airport {
  code: string;
  name: string;
  city: string;
  country: string;
}

/** Large commercial airports with an IATA code (OurAirports public-domain
 *  data, https://ourairports.com/data/ — no key, no network, bundled). */
export const AIRPORTS = raw as Airport[];

const BY_CODE = new Map(AIRPORTS.map((a) => [a.code, a]));

export function findAirport(code: string): Airport | undefined {
  return BY_CODE.get(code.trim().toUpperCase());
}

/** Airports whose code, name, or city starts with (code) or contains (name/city) `query`. */
export function searchAirports(query: string, limit = 6): Airport[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: Airport[] = [];
  for (const a of AIRPORTS) {
    if (a.code.toLowerCase().startsWith(q) || a.name.toLowerCase().includes(q) || a.city.toLowerCase().includes(q)) {
      results.push(a);
      if (results.length >= limit) break;
    }
  }
  return results;
}
