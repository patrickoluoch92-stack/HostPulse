import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { HybridAuthGuard } from '../../app/auth/hybrid-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { ClaimListingDto } from '../dto/claim-listing.dto';
import { CreateListingDto } from '../dto/create-listing.dto';
import { GetListingsDto } from '../dto/get-listings.dto';
import { GetNearbyListingsDto } from '../dto/get-nearby-listings.dto';
import { VerifyListingDto } from '../dto/verify-listing.dto';
import { ListingsJobsService } from '../jobs/listings-jobs.service';
import { ListingsService } from '../services/listings.service';

@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly listingsJobsService: ListingsJobsService,
  ) {}

  @Get()
  async getAll(@Query() query: GetListingsDto) {
    return this.listingsService.getAll(query);
  }

  @Get('nearby')
  async getNearby(@Query() query: GetNearbyListingsDto) {
    return this.listingsService.getNearby({ lat: query.lat, lng: query.lng, radiusKm: query.radius });
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.listingsService.getById(id);
  }

  @Post()
  @UseGuards(HybridAuthGuard)
  async create(@Req() req: any, @Body() body: CreateListingDto) {
    const userId = req?.user?.id ?? req?.user?.userId ?? req?.user?.sub;
    return this.listingsService.create(body, userId ? Number(userId) : undefined);
  }

  @Post('ingest/google')
  @UseGuards(HybridAuthGuard, RolesGuard)
  @Roles('admin')
  async ingestGooglePlaces() {
    return this.listingsService.ingestFromGooglePlaces();
  }

  @Post('jobs/refresh')
  @UseGuards(HybridAuthGuard, RolesGuard)
  @Roles('admin')
  async enqueueRefreshListingsJob() {
    return this.listingsJobsService.enqueueJob('refresh_listings');
  }

  @Post('jobs/ratings')
  @UseGuards(HybridAuthGuard, RolesGuard)
  @Roles('admin')
  async enqueueRefreshRatingsJob() {
    return this.listingsJobsService.enqueueJob('refresh_ratings');
  }

  @Post(':id/claim')
  @UseGuards(HybridAuthGuard)
  async claimListing(@Req() req: any, @Param('id') id: string, @Body() body: ClaimListingDto) {
    const userId = Number(req?.user?.id ?? req?.user?.userId ?? req?.user?.sub);
    return this.listingsService.claimListing(id, userId, body.message);
  }

  @Post(':id/verify')
  @UseGuards(HybridAuthGuard)
  async verifyListing(@Req() req: any, @Param('id') id: string, @Body() body: VerifyListingDto) {
    const userId = Number(req?.user?.id ?? req?.user?.userId ?? req?.user?.sub);
    const role = req?.user?.role;
    return this.listingsService.verifyListing(
      id,
      userId,
      role,
      body.isVerified,
      body.verificationNote,
    );
  }
}
