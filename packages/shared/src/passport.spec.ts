import { maskPassportNumber, passportExpiryStatus } from './passport';

const TODAY = new Date(2026, 8, 28); // 28 Sep 2026, local time

describe('passportExpiryStatus', () => {
  it('flags a date already past as expired', () => {
    expect(passportExpiryStatus('2026-09-27', TODAY)).toBe('expired');
  });

  it('flags anything under six months away as expiring, including today', () => {
    expect(passportExpiryStatus('2026-09-28', TODAY)).toBe('expiring');
    expect(passportExpiryStatus('2027-03-27', TODAY)).toBe('expiring');
  });

  it('treats six months or more as fine', () => {
    expect(passportExpiryStatus('2027-03-28', TODAY)).toBe('ok');
    expect(passportExpiryStatus('2032-01-01', TODAY)).toBe('ok');
  });

  it('rejects malformed input', () => {
    expect(passportExpiryStatus('2027-3-28', TODAY)).toBeNull();
  });
});

describe('maskPassportNumber', () => {
  it('shows only the last four characters', () => {
    expect(maskPassportNumber('1234')).toBe('•••• 1234');
  });
});
