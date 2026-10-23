import { initials } from './initials';

describe('initials', () => {
  it('takes the first letter of the first two words', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
  });

  it('uses one letter for a single word', () => {
    expect(initials('Ada')).toBe('A');
  });

  it('ignores words after the second', () => {
    expect(initials('Ada King Lovelace')).toBe('AK');
  });

  it('ignores extra whitespace', () => {
    expect(initials('  Ada \t  Lovelace  ')).toBe('AL');
  });

  it('upper-cases lowercase names', () => {
    expect(initials('ada lovelace')).toBe('AL');
  });

  it('returns an empty string for an empty or blank name', () => {
    expect(initials('')).toBe('');
    expect(initials('   ')).toBe('');
  });
});
