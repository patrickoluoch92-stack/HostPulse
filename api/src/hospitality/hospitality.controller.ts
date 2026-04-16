import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { HospitalityService } from './hospitality.service';

@Controller('hospitality')
export class HospitalityController {
  constructor(private readonly hospitalityService: HospitalityService) {}

  @Get()
  async search(
    @Query('county') county?: string,
    @Query('category') category?: string,
    @Query('q') q?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize = 20,
  ) {
    if (page < 1) {
      throw new BadRequestException('page must be >= 1');
    }
    if (pageSize < 1 || pageSize > 100) {
      throw new BadRequestException('pageSize must be between 1 and 100');
    }

    return this.hospitalityService.search({
      county,
      category,
      q,
      page,
      pageSize,
    });
  }

  @Get('stats')
  async stats() {
    return this.hospitalityService.stats();
  }
}
