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
    findById: mockFn().mockResolvedValue({ id: OWNER_ID, name: 'Owner' }),
    createPlaceholder: mockFn().mockImplementation((data: any) =>
      Promise.resolve({ id: 'placeholder-1', email: data.email ?? 'generated@member.invalid', name: data.name, isPlaceholder: true }),
    ),
    ...overrides.usersService,
  };
  const mailerService = { sendInviteEmail: mockFn().mockResolvedValue(undefined) };

  const service = new TripsService(prisma as any, usersService as any, mailerService as any);
  return { service, prisma, usersService, mailerService };
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

describe('TripsService.inviteMember', () => {
  it('adds an existing account directly and sends no email', async () => {
    const { service, prisma, mailerService } = makeDeps({
      usersService: { findByEmail: mockFn().mockResolvedValue({ id: 'user-2' }) },
      prisma: {
        tripMember: {
          findUnique: mockFn().mockImplementation(({ where }: any) =>
            Promise.resolve(where.tripId_userId.userId === OWNER_ID ? { tripId: TRIP_ID, userId: OWNER_ID, role: 'owner' } : null),
          ),
          create: mockFn().mockResolvedValue({ tripId: TRIP_ID, userId: 'user-2' }),
        },
      },
    });

    await service.inviteMember(TRIP_ID, OWNER_ID, 'existing@example.com');

    expect(prisma.tripMember.create).toHaveBeenCalledWith({
      data: { tripId: TRIP_ID, userId: 'user-2', role: 'member' },
    });
    expect(mailerService.sendInviteEmail).not.toHaveBeenCalled();
  });

  it('stores a pending invite and emails a new address', async () => {
    const { service, prisma, mailerService } = makeDeps({
      prisma: {
        tripInvite: { upsert: mockFn().mockResolvedValue({ id: 'invite-1', email: 'new@example.com' }) },
        trip: { findUnique: mockFn().mockResolvedValue({ name: 'Tokyo Trip' }) },
      },
    });

    await service.inviteMember(TRIP_ID, OWNER_ID, 'new@example.com');

    expect(mailerService.sendInviteEmail).toHaveBeenCalledWith('new@example.com', 'Tokyo Trip', 'Owner');
  });

  it('rejects a requester who is not the trip owner', async () => {
    const { service } = makeDeps({
      prisma: { tripMember: { findUnique: mockFn().mockResolvedValue(null) } },
    });

    await expect(service.inviteMember(TRIP_ID, 'outsider', 'x@example.com')).rejects.toThrow(ForbiddenException);
  });
});

describe('TripsService.duplicate', () => {
  function makeTrip(overrides: Record<string, any> = {}) {
    return {
      id: TRIP_ID,
      name: 'Tokyo Trip',
      startDate: null,
      endDate: null,
      coverPhoto: null,
      currency: 'USD',
      budget: null,
      destinationName: 'Tokyo',
      destinationLat: 35.68,
      destinationLng: 139.76,
      members: [{ userId: OWNER_ID, role: 'owner' }, { userId: 'member-2', role: 'member' }],
      places: [{ id: 'place-1', type: 'STOP', name: 'Shibuya', lat: 1, lng: 2, visitDate: null, order: 0, notes: null }],
      accommodations: [{ id: 'accom-1', name: 'Hotel', checkInDate: new Date(), checkOutDate: new Date(), notes: null }],
      ...overrides,
    };
  }

  it('rejects a requester who is not a member of the trip', async () => {
    const { service } = makeDeps({
      prisma: { trip: { findUnique: mockFn().mockResolvedValue(makeTrip()) } },
    });

    await expect(service.duplicate(TRIP_ID, 'outsider')).rejects.toThrow(ForbiddenException);
  });

  it('404s when the trip does not exist', async () => {
    const { service } = makeDeps({
      prisma: { trip: { findUnique: mockFn().mockResolvedValue(null) } },
    });

    await expect(service.duplicate(TRIP_ID, OWNER_ID)).rejects.toThrow('Trip not found');
  });

  it('clones members, places and accommodations, making the requester owner', async () => {
    const create = mockFn().mockImplementation((args: any) => Promise.resolve({ id: 'trip-2', ...args.data }));
    const { service } = makeDeps({
      prisma: {
        trip: { findUnique: mockFn().mockResolvedValue(makeTrip()), create },
      },
    });

    await service.duplicate(TRIP_ID, 'member-2');

    const data = create.mock.calls[0][0].data;
    expect(data.name).toBe('Tokyo Trip (copy)');
    expect(data.members.create).toEqual(
      expect.arrayContaining([
        { userId: 'member-2', role: 'owner' },
        { userId: OWNER_ID, role: 'member' },
      ]),
    );
    expect(data.places.create).toHaveLength(1);
    expect(data.places.create[0].name).toBe('Shibuya');
    expect(data.accommodations.create).toHaveLength(1);
  });
});
