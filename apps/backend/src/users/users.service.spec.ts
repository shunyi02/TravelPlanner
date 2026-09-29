import { jest } from '@jest/globals';
import { randomBytes } from 'crypto';
import { FieldCipherService } from './field-cipher.service';
import { UsersService } from './users.service';

// See expenses.service.spec.ts for why plain `any` mocks are used.
const mockFn = (): any => jest.fn();

function makeService() {
  process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  const cipher = new FieldCipherService();
  const prisma = { user: { update: mockFn().mockResolvedValue({}), findUnique: mockFn() } };
  return { service: new UsersService(prisma as any, cipher), prisma, cipher };
}

const baseUser = {
  id: 'user-1',
  email: 'alice@example.com',
  name: 'Alice',
  avatarUrl: null,
  passwordHash: 'hash',
  isPlaceholder: false,
  createdAt: new Date(),
  dateOfBirth: null,
  phone: null,
  nationality: null,
  passportNumberEncrypted: null,
  passportExpiry: null,
  homeCurrency: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  dietaryNotes: null,
};

describe('UsersService profile fields', () => {
  it('encrypts the passport number and never writes the plaintext', async () => {
    const { service, prisma, cipher } = makeService();

    await service.updateProfile('user-1', { passportNumber: 'E1234567X' });

    const data = prisma.user.update.mock.calls[0][0].data;
    expect(JSON.stringify(data)).not.toContain('E1234567X');
    expect(cipher.decrypt(data.passportNumberEncrypted)).toBe('E1234567X');
  });

  it('leaves the passport untouched when omitted, and clears it on null', async () => {
    const { service, prisma } = makeService();

    await service.updateProfile('user-1', { phone: '+65 9123 4567' });
    await service.updateProfile('user-1', { passportNumber: null });

    expect(prisma.user.update.mock.calls[0][0].data.passportNumberEncrypted).toBeUndefined();
    expect(prisma.user.update.mock.calls[1][0].data.passportNumberEncrypted).toBeNull();
  });

  it('stores calendar dates as UTC midnight and reads them back unchanged', async () => {
    const { service, prisma } = makeService();

    await service.updateProfile('user-1', { dateOfBirth: '1990-05-17', passportExpiry: '2031-01-02' });

    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.dateOfBirth.toISOString()).toBe('1990-05-17T00:00:00.000Z');
    const profile = service.toProfile({ ...baseUser, dateOfBirth: data.dateOfBirth, passportExpiry: data.passportExpiry });
    expect(profile.dateOfBirth).toBe('1990-05-17');
    expect(profile.passportExpiry).toBe('2031-01-02');
  });

  it('exposes only the last four passport characters in the profile', () => {
    const { service, cipher } = makeService();

    const profile = service.toProfile({ ...baseUser, passportNumberEncrypted: cipher.encrypt('E1234567X') });

    expect(profile.passportNumberLast4).toBe('567X');
    expect(JSON.stringify(profile)).not.toContain('E1234567X');
  });

  it('decrypts the full number on request', async () => {
    const { service, prisma, cipher } = makeService();
    prisma.user.findUnique.mockResolvedValue({ passportNumberEncrypted: cipher.encrypt('E1234567X') });

    await expect(service.getPassportNumber('user-1')).resolves.toBe('E1234567X');
  });
});
