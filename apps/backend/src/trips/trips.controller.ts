import {Body,Controller,Delete,Get,HttpCode,Param,Patch,Post,UseGuards} from '@nestjs/common';
import { UpdateTripDto } from './dto/update-trip.dto';
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { CreatePlaceDto } from './dto/create-place.dto';
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
}