import { jest } from '@jest/globals';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

// See expenses.service.spec.ts for why plain `any` mocks are used instead of
// `@jest/globals`' strictly-inferred `jest.fn()`.
const mockFn = (): any => jest.fn();

const USER_ID = 'user-1';
const EMAIL = 'alice@example.com';

function makeDeps(overrides: {
  prisma?: Record<string, any>;
  usersService?: Record<string, any>;
  jwtService?: Record<string, any>;
} = {}) {
  const prisma = {
    tripInvite: {
      findMany: mockFn().mockResolvedValue([]),
      deleteMany: mockFn().mockResolvedValue({ count: 0 }),
    },
    tripMember: {
      create: mockFn().mockResolvedValue({}),
    },
    refreshToken: {
      create: mockFn().mockResolvedValue({}),
      findUnique: mockFn(),
      update: mockFn().mockResolvedValue({}),
    },
    $transaction: mockFn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
    ...overrides.prisma,
  };
  const usersService = {
    findByEmail: mockFn().mockResolvedValue(null),
    create: mockFn().mockResolvedValue({ id: USER_ID, email: EMAIL, name: 'Alice' }),
    claimPlaceholder: mockFn().mockResolvedValue({ id: USER_ID, email: EMAIL, name: 'Alice', isPlaceholder: false }),
    verifyPassword: mockFn().mockResolvedValue(true),
    ...overrides.usersService,
  };
  const jwtService = {
    sign: mockFn().mockReturnValue('signed-jwt'),
    ...overrides.jwtService,
  };
  const mailerService = { sendPasswordResetEmail: mockFn().mockResolvedValue(undefined) };

  const service = new AuthService(prisma as any, usersService as any, jwtService as any, mailerService as any);
  return { service, prisma, usersService, jwtService };
}

describe('AuthService.register', () => {
  it('creates the user and issues a token pair', async () => {
    const { service, usersService, jwtService, prisma } = makeDeps();

    const tokens = await service.register({ email: EMAIL, name: 'Alice', password: 'password123' } as any);

    expect(usersService.create).toHaveBeenCalledWith({ email: EMAIL, name: 'Alice', password: 'password123' });
    expect(jwtService.sign).toHaveBeenCalledWith({ sub: USER_ID, email: EMAIL }, { expiresIn: '15m' });
    expect(prisma.refreshToken.create).toHaveBeenCalled();
    expect(tokens).toEqual({ accessToken: 'signed-jwt', refreshToken: expect.any(String) });
  });

  it('rejects an email that is already registered', async () => {
    const { service, usersService } = makeDeps({
      usersService: {
        findByEmail: mockFn().mockResolvedValue({ id: USER_ID, email: EMAIL, isPlaceholder: false }),
      },
    });

    await expect(
      service.register({ email: EMAIL, name: 'Alice', password: 'password123' } as any),
    ).rejects.toThrow(ConflictException);
    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('claims a placeholder account when its email registers, keeping the same id', async () => {
    const { service, usersService, jwtService } = makeDeps({
      usersService: {
        findByEmail: mockFn().mockResolvedValue({ id: USER_ID, email: EMAIL, isPlaceholder: true }),
      },
    });

    const tokens = await service.register({ email: EMAIL, name: 'Alice Real Name', password: 'password123' } as any);

    expect(usersService.create).not.toHaveBeenCalled();
    expect(usersService.claimPlaceholder).toHaveBeenCalledWith(USER_ID, {
      name: 'Alice Real Name',
      password: 'password123',
    });
    expect(jwtService.sign).toHaveBeenCalledWith({ sub: USER_ID, email: EMAIL }, { expiresIn: '15m' });
    expect(tokens.accessToken).toBe('signed-jwt');
  });

  it('does not touch trip invites when none are pending', async () => {
    const { service, prisma } = makeDeps();

    await service.register({ email: EMAIL, name: 'Alice', password: 'password123' } as any);

    expect(prisma.tripInvite.findMany).toHaveBeenCalledWith({ where: { email: EMAIL } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('joins pending trip invites and clears them', async () => {
    const invites = [{ id: 'invite-1', tripId: 'trip-1', email: EMAIL }];
    const { service, prisma } = makeDeps({
      prisma: { tripInvite: { findMany: mockFn().mockResolvedValue(invites), deleteMany: mockFn().mockResolvedValue({ count: 1 }) } },
    });

    await service.register({ email: EMAIL, name: 'Alice', password: 'password123' } as any);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.tripMember.create).toHaveBeenCalledWith({
      data: { tripId: 'trip-1', userId: USER_ID, role: 'member' },
    });
  });
});

describe('AuthService.login', () => {
  it('issues a token pair for valid credentials', async () => {
    const { service, jwtService } = makeDeps({
      usersService: {
        findByEmail: mockFn().mockResolvedValue({ id: USER_ID, email: EMAIL, passwordHash: 'hash' }),
        verifyPassword: mockFn().mockResolvedValue(true),
      },
    });

    const tokens = await service.login({ email: EMAIL, password: 'password123' } as any);

    expect(jwtService.sign).toHaveBeenCalledWith({ sub: USER_ID, email: EMAIL }, { expiresIn: '15m' });
    expect(tokens.accessToken).toBe('signed-jwt');
  });

  it('rejects an unknown email', async () => {
    const { service } = makeDeps({ usersService: { findByEmail: mockFn().mockResolvedValue(null) } });

    await expect(service.login({ email: EMAIL, password: 'x' } as any)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an invalid password', async () => {
    const { service } = makeDeps({
      usersService: {
        findByEmail: mockFn().mockResolvedValue({ id: USER_ID, email: EMAIL, passwordHash: 'hash' }),
        verifyPassword: mockFn().mockResolvedValue(false),
      },
    });

    await expect(service.login({ email: EMAIL, password: 'wrong' } as any)).rejects.toThrow(UnauthorizedException);
  });
});

describe('AuthService.refresh', () => {
  function storedToken(overrides: Record<string, any> = {}) {
    return {
      id: 'rt-1',
      revoked: false,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: USER_ID, email: EMAIL },
      ...overrides,
    };
  }

  it('rotates the refresh token and issues a new pair', async () => {
    const { service, prisma } = makeDeps({
      prisma: {
        refreshToken: {
          findUnique: mockFn().mockResolvedValue(storedToken()),
          update: mockFn().mockResolvedValue({}),
          create: mockFn().mockResolvedValue({}),
        },
      },
    });

    const tokens = await service.refresh('some-raw-token');

    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt-1' },
      data: { revoked: true },
    });
    expect(tokens.accessToken).toBe('signed-jwt');
  });

  it('rejects a token that does not exist', async () => {
    const { service } = makeDeps({ prisma: { refreshToken: { findUnique: mockFn().mockResolvedValue(null) } } });

    await expect(service.refresh('unknown')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a revoked token', async () => {
    const { service } = makeDeps({
      prisma: { refreshToken: { findUnique: mockFn().mockResolvedValue(storedToken({ revoked: true })) } },
    });

    await expect(service.refresh('reused')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an expired token', async () => {
    const { service } = makeDeps({
      prisma: {
        refreshToken: { findUnique: mockFn().mockResolvedValue(storedToken({ expiresAt: new Date(Date.now() - 1000) })) },
      },
    });

    await expect(service.refresh('expired')).rejects.toThrow(UnauthorizedException);
  });
});
