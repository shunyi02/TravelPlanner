import { ageOn, isOldEnoughToSignUp } from './age';

const TODAY = new Date(2026, 8, 28); // 28 Sep 2026, local time

describe('ageOn', () => {
  it('counts whole years, turning over on the birthday', () => {
    expect(ageOn('2013-09-28', TODAY)).toBe(13);
    expect(ageOn('2013-09-29', TODAY)).toBe(12);
    expect(ageOn('2013-10-01', TODAY)).toBe(12);
  });

  it('rejects malformed, impossible, and future dates', () => {
    expect(ageOn('2013-9-28', TODAY)).toBeNull();
    expect(ageOn('2013-02-30', TODAY)).toBeNull();
    expect(ageOn('2030-01-01', TODAY)).toBeNull();
  });
});

describe('isOldEnoughToSignUp', () => {
  it('allows 13 and over, blocks under 13 and invalid input', () => {
    expect(isOldEnoughToSignUp('2013-09-28', TODAY)).toBe(true);
    expect(isOldEnoughToSignUp('2013-09-29', TODAY)).toBe(false);
    expect(isOldEnoughToSignUp('not a date', TODAY)).toBe(false);
  });
});
