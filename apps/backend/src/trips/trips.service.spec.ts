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
      findMany: mockFn().mockResolvedValue([{ userId: OWNER_ID }, { userId: 'member-2' }]),
      create: mockFn().mockImplementation(({ data }: any) => Promise.resolve({ ...data })),
    },
    $transaction: mockFn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
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

describe('TripsService.addPlace', () => {
  it('creates a place with no assignees (visible to everyone) when none are given', async () => {
    const create = mockFn().mockImplementation((args: any) => Promise.resolve({ id: 'place-1', ...args.data }));
    const { service, prisma } = makeDeps({ prisma: { place: { create } } });

    await service.addPlace(TRIP_ID, OWNER_ID, { type: 'STOP', name: 'Beach' } as any);

    expect(create.mock.calls[0][0].data.assignments).toBeUndefined();
    expect(prisma.tripMember.findMany).not.toHaveBeenCalled();
  });

  it('creates a place scoped to a subset of members', async () => {
    const create = mockFn().mockImplementation((args: any) => Promise.resolve({ id: 'place-1', ...args.data }));
    const { service } = makeDeps({ prisma: { place: { create } } });

    await service.addPlace(TRIP_ID, OWNER_ID, { type: 'STOP', name: 'Beach', assigneeIds: ['member-2'] } as any);

    expect(create.mock.calls[0][0].data.assignments).toEqual({ create: [{ userId: 'member-2' }] });
  });

  it('rejects an assignee who is not a member of the trip', async () => {
    const { service } = makeDeps();

    await expect(
      service.addPlace(TRIP_ID, OWNER_ID, { type: 'STOP', name: 'Beach', assigneeIds: ['outsider'] } as any),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('TripsService.updatePlace', () => {
  function makeExistingPlace(overrides: Record<string, any> = {}) {
    return { id: 'place-1', tripId: TRIP_ID, name: 'Beach', ...overrides };
  }

  it('leaves assignments untouched when assigneeIds is omitted', async () => {
    const update = mockFn().mockImplementation((args: any) => Promise.resolve({ id: 'place-1', ...args.data }));
    const { service, prisma } = makeDeps({
      prisma: { place: { findUnique: mockFn().mockResolvedValue(makeExistingPlace()), update } },
    });

    await service.updatePlace(TRIP_ID, OWNER_ID, 'place-1', { name: 'Beach Club' } as any);

    expect(update).toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('replaces assignments when assigneeIds is given, deleting old ones first', async () => {
    const deleteMany = mockFn().mockResolvedValue({ count: 1 });
    const update = mockFn().mockImplementation((args: any) => Promise.resolve({ id: 'place-1', ...args.data }));
    const { service, prisma } = makeDeps({
      prisma: {
        place: { findUnique: mockFn().mockResolvedValue(makeExistingPlace()), update },
        placeAssignment: { deleteMany },
      },
    });

    await service.updatePlace(TRIP_ID, OWNER_ID, 'place-1', { assigneeIds: ['member-2'] } as any);

    expect(deleteMany).toHaveBeenCalledWith({ where: { placeId: 'place-1' } });
    expect(update.mock.calls[0][0].data.assignments).toEqual({ create: [{ userId: 'member-2' }] });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('clears assignments back to everyone when given an empty array', async () => {
    const deleteMany = mockFn().mockResolvedValue({ count: 2 });
    const update = mockFn().mockImplementation((args: any) => Promise.resolve({ id: 'place-1', ...args.data }));
    const { service } = makeDeps({
      prisma: {
        place: { findUnique: mockFn().mockResolvedValue(makeExistingPlace()), update },
        placeAssignment: { deleteMany },
      },
    });

    await service.updatePlace(TRIP_ID, OWNER_ID, 'place-1', { assigneeIds: [] } as any);

    expect(deleteMany).toHaveBeenCalledWith({ where: { placeId: 'place-1' } });
    expect(update.mock.calls[0][0].data.assignments).toBeUndefined();
  });

  it('rejects an assignee who is not a member of the trip', async () => {
    const { service } = makeDeps({
      prisma: { place: { findUnique: mockFn().mockResolvedValue(makeExistingPlace()) } },
    });

    await expect(
      service.updatePlace(TRIP_ID, OWNER_ID, 'place-1', { assigneeIds: ['outsider'] } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('404s when the place belongs to a different trip', async () => {
    const { service } = makeDeps({
      prisma: { place: { findUnique: mockFn().mockResolvedValue(makeExistingPlace({ tripId: 'other-trip' })) } },
    });

    await expect(service.updatePlace(TRIP_ID, OWNER_ID, 'place-1', { name: 'x' } as any)).rejects.toThrow(
      'Place not found',
    );
  });
});

describe('TripsService.listForUser', () => {
  it('returns each trip with its located places as a route in itinerary order, without the full places', async () => {
    const d = (s: string) => new Date(s);
    const { service } = makeDeps({
      prisma: {
        trip: {
          findMany: mockFn().mockResolvedValue([
            {
              id: TRIP_ID,
              name: 'Tokyo',
              places: [
                { lat: 3, lng: 30, visitDate: d('2026-11-13T09:00:00Z'), checkIn: null, departureTime: null, order: 0 },
                { lat: 1, lng: 10, visitDate: null, checkIn: d('2026-11-12T06:00:00Z'), departureTime: null, order: 5 },
                { lat: 9, lng: 90, visitDate: null, checkIn: null, departureTime: null, order: 1 },
                { lat: 2, lng: 20, visitDate: d('2026-11-12T08:00:00Z'), checkIn: null, departureTime: null, order: 2 },
              ],
            },
          ]),
        },
      },
    });

    const [trip] = await service.listForUser(OWNER_ID);

    expect(trip.route).toEqual([[1, 10], [2, 20], [3, 30], [9, 90]]);
    expect(trip).not.toHaveProperty('places');
  });
});

describe('TripsService.update', () => {
  function deps() {
    const d = makeDeps({
      prisma: {
        tripMember: { findUnique: mockFn().mockResolvedValue({ tripId: TRIP_ID, userId: OWNER_ID, role: 'member' }) },
        trip: { update: mockFn().mockResolvedValue({ id: TRIP_ID, name: 'Tokyo' }) },
        $executeRaw: mockFn().mockResolvedValue(3),
      },
    });
    return { service: d.service, prisma: d.prisma as any };
  }

  it('updates dates alone without touching the itinerary', async () => {
    const { service, prisma } = deps();

    await service.update(TRIP_ID, OWNER_ID, { startDate: '2026-11-19', endDate: '2026-11-23' });

    expect(prisma.trip.update).toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('shifts places and accommodations in the same transaction as the date change', async () => {
    const { service, prisma } = deps();

    const trip = await service.update(TRIP_ID, OWNER_ID, {
      startDate: '2026-11-19',
      endDate: '2026-11-23',
      shiftItineraryDays: 7,
    });

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    const [placeSql] = prisma.$executeRaw.mock.calls[0];
    expect(placeSql.join('?')).toContain('UPDATE "Place"');
    expect(prisma.$executeRaw.mock.calls[0]).toContain(7);
    expect(prisma.$executeRaw.mock.calls[0]).toContain(TRIP_ID);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(3);
    expect(trip).toEqual({ id: TRIP_ID, name: 'Tokyo' });
  });

  it('rejects an end date before the start date before writing anything', async () => {
    const { service, prisma } = deps();

    await expect(
      service.update(TRIP_ID, OWNER_ID, { startDate: '2026-11-19', endDate: '2026-11-10', shiftItineraryDays: 7 }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
