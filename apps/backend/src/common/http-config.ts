/**
 * Express "trust proxy" from TRUST_PROXY. Behind a host's load balancer
 * (e.g. Render), every request arrives from the proxy, so without this
 * req.ip is the proxy's address and the auth rate limit would lump all users
 * together. A number trusts that many hops from the right of
 * X-Forwarded-For, which a client can't spoof past; "true" would trust any
 * client-sent header, so it isn't accepted. Unset means no proxy (local dev).
 */
export function parseTrustProxy(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const hops = Number(value);
  if (!Number.isInteger(hops) || hops < 0) {
    throw new Error(`TRUST_PROXY must be a whole number of proxy hops, got "${value}"`);
  }
  return hops;
}

/**
 * Allowed browser origins from CORS_ORIGINS (comma-separated, e.g. the
 * deployed web app's URL). Unset allows any origin, which suits local dev.
 * The API authenticates with a bearer token rather than cookies, so another
 * site can't make signed-in calls either way; this just keeps other sites
 * from using the API from a browser.
 */
export function parseCorsOrigins(value: string | undefined): string[] | true {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return origins.length > 0 ? origins : true;
}
