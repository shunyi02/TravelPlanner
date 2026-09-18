import { PrismaService } from '../prisma/prisma.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { CreatePlaceDto } from './dto/create-place.dto';
import { CreateAccommodationDto } from './dto/create-accommodation.dto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateTripDto } from './dto/update-trip.dto';

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates a trip and makes the creator its owner. */
  async create(userId: string, dto: CreateTripDto) {
    return this.prisma.trip.create({
      data: {
        name: dto.name,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        coverPhoto: dto.coverPhoto,
        members: {
          create: { userId, role: 'owner' },
        },
      },
      include: { members: true },
    });
  }

  async listForUser(userId: string) {
    return this.prisma.trip.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOneOrThrow(tripId: string, userId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        members: { include: { user: true } },
        places: { orderBy: { order: 'asc' } },
        accommodations: { orderBy: { checkInDate: 'asc' } },
      },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    if (!trip.members.some((m) => m.userId === userId)) {
      throw new ForbiddenException('Not a member of this trip');
    }
    return trip;
  }

  async addMember(tripId: string, requesterId: string, newUserId: string) {
    await this.assertMember(tripId, requesterId);
    return this.prisma.tripMember.create({
      data: { tripId, userId: newUserId, role: 'member' },
    });
  }

  async addPlace(tripId: string, userId: string, dto: CreatePlaceDto) {
    await this.assertMember(tripId, userId);
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
      },
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

    return this.prisma.place.findMany({ where: { tripId }, orderBy: { order: 'asc' } });
  }

  private async assertMember(tripId: string, userId: string) {
    const membership = await this.prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a member of this trip');
  }

  async updateDates(tripId: string, userId: string, dto: UpdateTripDto) {
    await this.assertMember(tripId, userId);

    if (dto.startDate && dto.endDate && new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    return this.prisma.trip.update({
      where: { id: tripId },
      data: {
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }


  /** Delete Trip */
  async delete(tripId: string, userId: string) {
    const membership = await this.prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a member of this trip');
    if (membership.role !== 'owner') {
      throw new ForbiddenException('Only the owner can delete this trip');
    }
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
