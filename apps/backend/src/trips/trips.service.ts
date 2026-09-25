import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MailerService } from '../mailer/mailer.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { CreatePlaceDto } from './dto/create-place.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';
import { CreateAccommodationDto } from './dto/create-accommodation.dto';
import { AddManualMemberDto } from './dto/add-manual-member.dto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateTripDto } from './dto/update-trip.dto';

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly mailerService: MailerService,
  ) {}

  /** Creates a trip and makes the creator its owner. */
  async create(userId: string, dto: CreateTripDto) {
    return this.prisma.trip.create({
      data: {
        name: dto.name,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        coverPhoto: dto.coverPhoto,
        currency: dto.currency,
        budget: dto.budget,
        destinationName: dto.destinationName,
        destinationLat: dto.destinationLat,
        destinationLng: dto.destinationLng,
        members: {
          create: { userId, role: 'owner' },
        },
      },
      include: { members: true },
    });
  }

  /** Each trip comes with `route`: its located places as [lat, lng] pairs in
   *  itinerary order, enough for the trip list to sketch a mini route map
   *  without loading every place in full. */
  async listForUser(userId: string) {
    const trips = await this.prisma.trip.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: 'desc' },
      include: {
        places: {
          where: { lat: { not: null }, lng: { not: null } },
          select: { lat: true, lng: true, visitDate: true, checkIn: true, departureTime: true, order: true },
        },
      },
    });

    return trips.map(({ places, ...trip }) => ({
      ...trip,
      route: places
        .map((p) => ({ p, at: (p.visitDate ?? p.checkIn ?? p.departureTime)?.getTime() ?? Infinity }))
        .sort((a, b) => a.at - b.at || (a.p.order ?? 0) - (b.p.order ?? 0))
        .map(({ p }) => [p.lat!, p.lng!] as [number, number]),
    }));
  }

  async getOneOrThrow(tripId: string, userId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        members: { include: { user: true } },
        places: { orderBy: { order: 'asc' }, include: { assignments: true } },
        accommodations: { orderBy: { checkInDate: 'asc' } },
        invites: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    if (!trip.members.some((m) => m.userId === userId)) {
      throw new ForbiddenException('Not a member of this trip');
    }
    return trip;
  }

  /**
   * Clones a trip's structure — members, itinerary places, accommodations —
   * as a new trip owned by the requester. Expenses and pending invites are
   * intentionally left behind: a duplicate is a fresh trip to plan, not a
   * copy of what was already spent or who was mid-invite.
   */
  async duplicate(tripId: string, requesterId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: { members: true, places: true, accommodations: true },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    if (!trip.members.some((m) => m.userId === requesterId)) {
      throw new ForbiddenException('Not a member of this trip');
    }

    const memberIds = new Set(trip.members.map((m) => m.userId));
    memberIds.add(requesterId);

    return this.prisma.trip.create({
      data: {
        name: `${trip.name} (copy)`,
        startDate: trip.startDate,
        endDate: trip.endDate,
        coverPhoto: trip.coverPhoto,
        currency: trip.currency,
        budget: trip.budget,
        destinationName: trip.destinationName,
        destinationLat: trip.destinationLat,
        destinationLng: trip.destinationLng,
        members: {
          create: [...memberIds].map((userId) => ({
            userId,
            role: userId === requesterId ? 'owner' : 'member',
          })),
        },
        places: {
          create: trip.places.map((p) => ({
            type: p.type,
            name: p.name,
            lat: p.lat,
            lng: p.lng,
            visitDate: p.visitDate,
            order: p.order,
            notes: p.notes,
            departureTime: p.departureTime,
            arrivalTime: p.arrivalTime,
            departureAirport: p.departureAirport,
            arrivalAirport: p.arrivalAirport,
            checkIn: p.checkIn,
            checkOut: p.checkOut,
          })),
        },
        accommodations: {
          create: trip.accommodations.map((a) => ({
            name: a.name,
            checkInDate: a.checkInDate,
            checkOutDate: a.checkOutDate,
            notes: a.notes,
          })),
        },
      },
      include: { members: true },
    });
  }

  async addMember(tripId: string, requesterId: string, newUserId: string) {
    await this.assertMember(tripId, requesterId);
    return this.prisma.tripMember.create({
      data: { tripId, userId: newUserId, role: 'member' },
    });
  }

  /**
   * Invite a member by email. If they already have an account, they're added
   * immediately; otherwise a pending TripInvite is stored and consumed the
   * moment they register with that email (see AuthService.register).
   */
  async inviteMember(tripId: string, requesterId: string, email: string) {
    await this.assertOwner(tripId, requesterId);

    const user = await this.usersService.findByEmail(email);
    if (user) {
      const existingMembership = await this.prisma.tripMember.findUnique({
        where: { tripId_userId: { tripId, userId: user.id } },
      });
      if (existingMembership) {
        throw new BadRequestException('Already a member of this trip');
      }
      return this.prisma.tripMember.create({
        data: { tripId, userId: user.id, role: 'member' },
      });
    }

    const invite = await this.prisma.tripInvite.upsert({
      where: { tripId_email: { tripId, email } },
      create: { tripId, email, invitedBy: requesterId },
      update: {},
    });

    // Best-effort: a stalled mail provider shouldn't fail the invite itself.
    const [trip, inviter] = await Promise.all([
      this.prisma.trip.findUnique({ where: { id: tripId }, select: { name: true } }),
      this.usersService.findById(requesterId),
    ]);
    if (trip && inviter) {
      this.mailerService.sendInviteEmail(email, trip.name, inviter.name).catch(() => {});
    }

    return invite;
  }

  /**
   * Adds a member by name (and optionally a real email) without requiring
   * them to register — so they can be picked in expense splits right away.
   * If the email already belongs to a real account, that account is added
   * directly instead. If it belongs to a placeholder already added to some
   * other trip, that same placeholder is reused here too. A placeholder's
   * email (if it has one) becomes a real login the moment someone registers
   * with it — see AuthService.register.
   */
  async addManualMember(tripId: string, requesterId: string, dto: AddManualMemberDto) {
    await this.assertOwner(tripId, requesterId);

    const user = dto.email
      ? (await this.usersService.findByEmail(dto.email)) ?? (await this.usersService.createPlaceholder(dto))
      : await this.usersService.createPlaceholder(dto);

    const existingMembership = await this.prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: user.id } },
    });
    if (existingMembership) {
      throw new BadRequestException('Already a member of this trip');
    }

    return this.prisma.tripMember.create({
      data: { tripId, userId: user.id, role: 'member' },
      include: { user: true },
    });
  }

  async cancelInvite(tripId: string, requesterId: string, inviteId: string) {
    await this.assertOwner(tripId, requesterId);
    await this.prisma.tripInvite.deleteMany({ where: { id: inviteId, tripId } });
  }

  async addPlace(tripId: string, userId: string, dto: CreatePlaceDto) {
    await this.assertMember(tripId, userId);
    if (dto.assigneeIds?.length) await this.assertValidAssignees(tripId, dto.assigneeIds);

    return this.prisma.place.create({
      data: {
        tripId,
        type: dto.type,
        name: dto.name,
        lat: dto.lat,
        lng: dto.lng,
        visitDate: dto.visitDate ? new Date(dto.visitDate) : undefined,
        order: dto.order,
        notes: dto.notes,
        departureTime: dto.departureTime ? new Date(dto.departureTime) : undefined,
        arrivalTime: dto.arrivalTime ? new Date(dto.arrivalTime) : undefined,
        departureAirport: dto.departureAirport,
        arrivalAirport: dto.arrivalAirport,
        checkIn: dto.checkIn ? new Date(dto.checkIn) : undefined,
        checkOut: dto.checkOut ? new Date(dto.checkOut) : undefined,
        assignments: dto.assigneeIds?.length
          ? { create: dto.assigneeIds.map((assigneeId) => ({ userId: assigneeId })) }
          : undefined,
      },
      include: { assignments: true },
    });
  }

  async updatePlace(tripId: string, userId: string, placeId: string, dto: UpdatePlaceDto) {
    await this.assertMember(tripId, userId);
    const place = await this.prisma.place.findUnique({ where: { id: placeId } });
    if (!place || place.tripId !== tripId) {
      throw new NotFoundException('Place not found');
    }
    if (dto.assigneeIds?.length) await this.assertValidAssignees(tripId, dto.assigneeIds);

    if (dto.assigneeIds) {
      const [, updated] = await this.prisma.$transaction([
        this.prisma.placeAssignment.deleteMany({ where: { placeId } }),
        this.prisma.place.update({
          where: { id: placeId },
          data: {
            type: dto.type,
            name: dto.name,
            lat: dto.lat,
            lng: dto.lng,
            visitDate: dto.visitDate ? new Date(dto.visitDate) : undefined,
            notes: dto.notes,
            departureTime: dto.departureTime ? new Date(dto.departureTime) : undefined,
            arrivalTime: dto.arrivalTime ? new Date(dto.arrivalTime) : undefined,
            departureAirport: dto.departureAirport,
            arrivalAirport: dto.arrivalAirport,
            checkIn: dto.checkIn ? new Date(dto.checkIn) : undefined,
            checkOut: dto.checkOut ? new Date(dto.checkOut) : undefined,
            assignments: dto.assigneeIds.length
              ? { create: dto.assigneeIds.map((assigneeId) => ({ userId: assigneeId })) }
              : undefined,
          },
          include: { assignments: true },
        }),
      ]);
      return updated;
    }

    return this.prisma.place.update({
      where: { id: placeId },
      data: {
        type: dto.type,
        name: dto.name,
        lat: dto.lat,
        lng: dto.lng,
        visitDate: dto.visitDate ? new Date(dto.visitDate) : undefined,
        notes: dto.notes,
        departureTime: dto.departureTime ? new Date(dto.departureTime) : undefined,
        arrivalTime: dto.arrivalTime ? new Date(dto.arrivalTime) : undefined,
        departureAirport: dto.departureAirport,
        arrivalAirport: dto.arrivalAirport,
        checkIn: dto.checkIn ? new Date(dto.checkIn) : undefined,
        checkOut: dto.checkOut ? new Date(dto.checkOut) : undefined,
      },
      include: { assignments: true },
    });
  }

  async deletePlace(tripId: string, userId: string, placeId: string) {
    await this.assertMember(tripId, userId);

    await this.prisma.place.deleteMany({
      where: {
        id: placeId,
        tripId,
      },
    });
  }

  /**
   * Manually reorder a trip's itinerary. Takes the full list of place IDs in the
   * desired order and writes sequential `order` values.
   *
   * This is NOT route optimization (no distance/time minimization) — it's a
   * user-driven drag-and-drop reorder. Automatic optimization would need a
   * geo/routing provider, which is out of scope for now.
   */
  async reorderPlaces(tripId: string, userId: string, orderedPlaceIds: string[]) {
    await this.assertMember(tripId, userId);
    const places = await this.prisma.place.findMany({ where: { tripId } });
    const validIds = new Set(places.map((p) => p.id));
    for (const id of orderedPlaceIds) {
      if (!validIds.has(id)) {
        throw new NotFoundException(`Place ${id} not found in trip ${tripId}`);
      }
    }

    await this.prisma.$transaction(
      orderedPlaceIds.map((placeId, index) =>
        this.prisma.place.update({ where: { id: placeId }, data: { order: index } }),
      ),
    );

    return this.prisma.place.findMany({
      where: { tripId },
      orderBy: { order: 'asc' },
      include: { assignments: true },
    });
  }

  private async assertMember(tripId: string, userId: string) {
    const membership = await this.prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a member of this trip');
  }

  private async assertValidAssignees(tripId: string, assigneeIds: string[]) {
    const members = await this.prisma.tripMember.findMany({ where: { tripId } });
    const validIds = new Set(members.map((m) => m.userId));
    for (const id of assigneeIds) {
      if (!validIds.has(id)) {
        throw new BadRequestException(`Assignee ${id} is not a member of this trip`);
      }
    }
  }

  private async assertOwner(tripId: string, userId: string) {
    const membership = await this.prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a member of this trip');
    if (membership.role !== 'owner') {
      throw new ForbiddenException('Only the owner can do this');
    }
  }

  async update(tripId: string, userId: string, dto: UpdateTripDto) {
    await this.assertMember(tripId, userId);

    if (dto.startDate && dto.endDate && new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    const updateTrip = this.prisma.trip.update({
      where: { id: tripId },
      data: {
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        currency: dto.currency,
        budget: dto.budget,
        destinationName: dto.destinationName,
        destinationLat: dto.destinationLat,
        destinationLng: dto.destinationLng,
      },
    });

    const shift = dto.shiftItineraryDays ?? 0;
    if (shift === 0) return updateTrip;

    // Whole-day shifts keep each item's time of day. Null dates stay null.
    const [, , trip] = await this.prisma.$transaction([
      this.prisma.$executeRaw`
        UPDATE "Place" SET
          "visitDate" = "visitDate" + make_interval(days => ${shift}::int),
          "checkIn" = "checkIn" + make_interval(days => ${shift}::int),
          "checkOut" = "checkOut" + make_interval(days => ${shift}::int),
          "departureTime" = "departureTime" + make_interval(days => ${shift}::int),
          "arrivalTime" = "arrivalTime" + make_interval(days => ${shift}::int)
        WHERE "tripId" = ${tripId}`,
      this.prisma.$executeRaw`
        UPDATE "Accommodation" SET
          "checkInDate" = "checkInDate" + make_interval(days => ${shift}::int),
          "checkOutDate" = "checkOutDate" + make_interval(days => ${shift}::int)
        WHERE "tripId" = ${tripId}`,
      updateTrip,
    ]);
    return trip;
  }


  /** Delete Trip */
  async delete(tripId: string, userId: string) {
    await this.assertOwner(tripId, userId);
    await this.prisma.trip.delete({ where: { id: tripId } });
  }

  async addAccommodation(
    tripId: string,
    userId: string,
    dto: CreateAccommodationDto,
  ) {
    await this.assertMember(tripId, userId);

    if (new Date(dto.checkOutDate) < new Date(dto.checkInDate)) {
      throw new BadRequestException(
        'checkOutDate must be on or after checkInDate',
      );
    }

    return this.prisma.accommodation.create({
      data: {
        tripId,
        name: dto.name,
        checkInDate: new Date(dto.checkInDate),
        checkOutDate: new Date(dto.checkOutDate),
        notes: dto.notes,
      },
    });
  }

  async deleteAccommodation(
    tripId: string,
    userId: string,
    accommodationId: string,
  ) {
    await this.assertMember(tripId, userId);

    await this.prisma.accommodation.deleteMany({
      where: {
        id: accommodationId,
        tripId,
      },
    });
  }

}
