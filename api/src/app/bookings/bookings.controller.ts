import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BookingsService } from './bookings.service';

class CreateBookingDto {
  propertyId: number;
  startDate: string;
  endDate: string;
  total: number;
}

@Controller('bookings')
@UseGuards(AuthGuard('jwt'))
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Post()
  async create(@Request() req, @Body() dto: CreateBookingDto) {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;
    return this.bookingsService.create(
      userId,
      dto.propertyId,
      dto.startDate,
      dto.endDate,
      dto.total,
    );
  }
}
