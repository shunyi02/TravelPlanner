import { jest } from '@jest/globals';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TripsService } from './trips.service';

// See expenses.service.spec.ts for why plain `any` mocks are used instead of
// `@jest/globals`' strictly-inferred `jest.fn()`.
const mockFn = (): any => jest.fn();

const TRIP_ID = 'trip-1';
const OWNER_ID = 'owner-1';

function makeDeps(overrides: { prisma?: Record<string, any>; usersService?: Record<string, any> } = {}) {
  const prisma = {
    tripMember: {
      // assertOwner looks up the requester (OWNER_ID); addManualMember then
      // separately checks the resolved member isn't already in the trip —
      // only the former should find something by default.
      findUnique: mockFn().mockImplementation(({ where }: any) =>
        Promise.resolve(
          where.tripId_userId.userId === OWNER_ID ? { tripId: TRIP_ID, userId: OWNER_ID, role: 'owner' } : null,
        ),
      ),
      create: mockFn().mockImplementation(({ data }: any) => Promise.resolve({ ...data })),
    },
    ...overrides.prisma,
  };
  const usersService = {
    findByEmail: mockFn().mockResolvedValue(null),
    createPlaceholder: mockFn().mockImplementation((data: any) =>
      Promise.resolve({ id: 'placeholder-1', email: data.email ?? 'generated@member.invalid', name: data.name, isPlaceholder: true }),
    ),
    ...overrides.usersService,
  };

  const service = new TripsService(prisma as any, usersService as any);
  return { service, prisma, usersService };
}

describe('TripsService.addManualMember', () => {
  it('rejects a requester who is not the trip owner', async () => {
    const { service } = makeDeps({
      prisma: { tripMember: { findUnique: mockFn().mockResolvedValue({ role: 'member' }) } },
    });

    await expect(service.addManualMember(TRIP_ID, 'not-owner', { name: 'Bob' } as any)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('creates a nameless-email placeholder and adds it as a member', async () => {
    const { service, usersService, prisma } = makeDeps();

    const member = await service.addManualMember(TRIP_ID, OWNER_ID, { name: 'Bob' } as any);

    expect(usersService.createPlaceholder).toHaveBeenCalledWith({ name: 'Bob' });
    expect(prisma.tripMember.create).toHaveBeenCalledWith({
      data: { tripId: TRIP_ID, userId: 'placeholder-1', role: 'member' },
      include: { user: true },
    });
    expect(member.userId).toBe('placeholder-1');
  });

  it('adds an existing real account directly, without creating a placeholder', async () => {
    const { service, usersService, prisma } = makeDeps({
      usersService: {
        findByEmail: mockFn().mockResolvedValue({ id: 'real-user', email: 'carol@example.com', isPlaceholder: false }),
      },
    });

    await service.addManualMember(TRIP_ID, OWNER_ID, { name: 'Carol', email: 'carol@example.com' } as any);

    expect(usersService.createPlaceholder).not.toHaveBeenCalled();
    expect(prisma.tripMember.create).toHaveBeenCalledWith({
      data: { tripId: TRIP_ID, userId: 'real-user', role: 'member' },
      include: { user: true },
    });
  });

  it('reuses an existing placeholder for the same email instead of creating a new one', async () => {
    const { service, usersService, prisma } = makeDeps({
      usersService: {
        findByEmail: mockFn().mockResolvedValue({ id: 'placeholder-existing', email: 'dan@example.com', isPlaceholder: true }),
      },
    });

    await service.addManualMember(TRIP_ID, OWNER_ID, { name: 'Dan', email: 'dan@example.com' } as any);

    expect(usersService.createPlaceholder).not.toHaveBeenCalled();
    expect(prisma.tripMember.create).toHaveBeenCalledWith({
      data: { tripId: TRIP_ID, userId: 'placeholder-existing', role: 'member' },
      include: { user: true },
    });
  });

  it('creates a placeholder with the given email when no account exists for it', async () => {
    const { service, usersService } = makeDeps();

    await service.addManualMember(TRIP_ID, OWNER_ID, { name: 'Eve', email: 'eve@example.com' } as any);

    expect(usersService.createPlaceholder).toHaveBeenCalledWith({ name: 'Eve', email: 'eve@example.com' });
  });

  it('refuses to add someone who is already a member of this trip', async () => {
    const findUnique = mockFn();
    findUnique.mockResolvedValueOnce({ tripId: TRIP_ID, userId: OWNER_ID, role: 'owner' }); // assertOwner
    findUnique.mockResolvedValueOnce({ tripId: TRIP_ID, userId: 'placeholder-1', role: 'member' }); // existing membership
    const { service, prisma } = makeDeps({ prisma: { tripMember: { findUnique, create: mockFn() } } });

    await expect(service.addManualMember(TRIP_ID, OWNER_ID, { name: 'Bob' } as any)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.tripMember.create).not.toHaveBeenCalled();
  });
});
