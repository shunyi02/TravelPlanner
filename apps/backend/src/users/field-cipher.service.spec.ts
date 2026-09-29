import { randomBytes } from 'crypto';
import { FieldCipherService } from './field-cipher.service';

describe('FieldCipherService', () => {
  const originalKey = process.env.FIELD_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  });

  afterAll(() => {
    process.env.FIELD_ENCRYPTION_KEY = originalKey;
  });

  it('round-trips a value without storing the plaintext', () => {
    const cipher = new FieldCipherService();
    const stored = cipher.encrypt('E1234567X');
    expect(stored).not.toContain('E1234567X');
    expect(cipher.decrypt(stored)).toBe('E1234567X');
  });

  it('uses a fresh IV each time, so equal inputs give different ciphertext', () => {
    const cipher = new FieldCipherService();
    expect(cipher.encrypt('E1234567X')).not.toBe(cipher.encrypt('E1234567X'));
  });

  it('rejects a tampered value', () => {
    const cipher = new FieldCipherService();
    const [iv, tag, data] = cipher.encrypt('E1234567X').split(':');
    const flipped = Buffer.from(data, 'base64');
    flipped[0] ^= 1;
    expect(() => cipher.decrypt([iv, tag, flipped.toString('base64')].join(':'))).toThrow();
  });

  it('cannot decrypt with a different key', () => {
    const stored = new FieldCipherService().encrypt('E1234567X');
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    expect(() => new FieldCipherService().decrypt(stored)).toThrow();
  });

  it('refuses to start without a valid 32-byte key', () => {
    delete process.env.FIELD_ENCRYPTION_KEY;
    expect(() => new FieldCipherService()).toThrow('FIELD_ENCRYPTION_KEY is not set');
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(16).toString('base64');
    expect(() => new FieldCipherService()).toThrow('32 bytes');
  });
});
