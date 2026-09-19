import {Body,Controller,Delete,Get,HttpCode,Param,Patch,Post,UseGuards} from '@nestjs/common';
import { UpdateTripDto } from './dto/update-trip.dto';
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { CreatePlaceDto } from './dto/create-place.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';
import { CreateAccommodationDto } from './dto/create-accommodation.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { AddManualMemberDto } from './dto/add-manual-member.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post()
  create(@CurrentUser() userId: string, @Body() dto: CreateTripDto) {
    return this.tripsService.create(userId, dto);
  }

  @Get()
  listMine(@CurrentUser() userId: string) {
    return this.tripsService.listForUser(userId);
  }

  @Get(':tripId')
  getOne(@CurrentUser() userId: string, @Param('tripId') tripId: string) {
    return this.tripsService.getOneOrThrow(tripId, userId);
  }

  @Post(':tripId/members')
  addMember(
    @CurrentUser() userId: string,
    @Param('tripId') tripId: string,
    @Body('userId') newUserId: string,
  ) {
    return this.tripsService.addMember(tripId, userId, newUserId);
  }

  @Post(':tripId/members/manual')
  addManualMember(
    @CurrentUser() userId: string,
    @Param('tripId') tripId: string,
    @Body() dto: AddManualMemberDto,
  ) {
    return this.tripsService.addManualMember(tripId, userId, dto);
  }

  @Post(':tripId/invites')
  inviteMember(
    @CurrentUser() userId: string,
    @Param('tripId') tripId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.tripsService.inviteMember(tripId, userId, dto.email);
  }

  @Delete(':tripId/invites/:inviteId')
  @HttpCode(204)
  cancelInvite(
    @CurrentUser() userId: string,
    @Param('tripId') tripId: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.tripsService.cancelInvite(tripId, userId, inviteId);
  }

  @Post(':tripId/places')
  addPlace(
    @CurrentUser() userId: string,
    @Param('tripId') tripId: string,
    @Body() dto: CreatePlaceDto,
  ) {
    return this.tripsService.addPlace(tripId, userId, dto);
  }

  @Patch(':tripId/places/reorder')
  reorderPlaces(
    @CurrentUser() userId: string,
    @Param('tripId') tripId: string,
    @Body('orderedPlaceIds') orderedPlaceIds: string[],
  ) {
    return this.tripsService.reorderPlaces(tripId, userId, orderedPlaceIds);
  }

  @Patch(':tripId')
  updateDates(
    @CurrentUser() userId: string,
    @Param('tripId') tripId: string,
    @Body() dto: UpdateTripDto,
  ) {
    return this.tripsService.updateDates(tripId, userId, dto);
  }

  @Delete(':tripId')
  @HttpCode(204)
  delete(@CurrentUser() userId: string, @Param('tripId') tripId: string) {
    return this.tripsService.delete(tripId, userId);
  }

  @Post(':tripId/accommodations')
  addAccommodation(
    @CurrentUser() userId: string,
    @Param('tripId') tripId: string,
    @Body() dto: CreateAccommodationDto,
  ) {
    return this.tripsService.addAccommodation(tripId, userId, dto);
  }

  @Delete(':tripId/accommodations/:accommodationId')
  @HttpCode(204)
  deleteAccommodation(
    @CurrentUser() userId: string,
    @Param('tripId') tripId: string,
    @Param('accommodationId') accommodationId: string,
  ) {
    return this.tripsService.deleteAccommodation(tripId, userId, accommodationId);
  }

  @Patch(':tripId/places/:placeId')
  updatePlace(
    @CurrentUser() userId: string,
    @Param('tripId') tripId: string,
    @Param('placeId') placeId: string,
    @Body() dto: UpdatePlaceDto,
  ) {
    return this.tripsService.updatePlace(tripId, userId, placeId, dto);
  }

  @Delete(':tripId/places/:placeId')
  @HttpCode(204)
  deletePlace(
    @CurrentUser() userId: string,
    @Param('tripId') tripId: string,
    @Param('placeId') placeId: string,
  ) {
    return this.tripsService.deletePlace(tripId, userId, placeId);
  }
}