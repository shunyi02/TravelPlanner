import { parseCorsOrigins, parseTrustProxy } from './http-config';

describe('parseTrustProxy', () => {
  it('is off when unset or blank', () => {
    expect(parseTrustProxy(undefined)).toBeUndefined();
    expect(parseTrustProxy(' ')).toBeUndefined();
  });

  it('takes a number of hops', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('0')).toBe(0);
  });

  it('rejects "true" and other values that would trust spoofable headers', () => {
    expect(() => parseTrustProxy('true')).toThrow('TRUST_PROXY');
    expect(() => parseTrustProxy('-1')).toThrow('TRUST_PROXY');
    expect(() => parseTrustProxy('1.5')).toThrow('TRUST_PROXY');
  });
});

describe('parseCorsOrigins', () => {
  it('allows any origin when unset', () => {
    expect(parseCorsOrigins(undefined)).toBe(true);
    expect(parseCorsOrigins('')).toBe(true);
  });

  it('splits a comma-separated list and drops trailing slashes', () => {
    expect(parseCorsOrigins('https://cuti.pages.dev/, https://cuti.app')).toEqual([
      'https://cuti.pages.dev',
      'https://cuti.app',
    ]);
  });
});
