import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BookingsService } from './bookings.service';

// Renamed to avoid route collision with app/bookings
@Controller('legacy-bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  async create(
    @Request() req: { user: { userId: number } },
    @Body() body: CreateBookingDto,
  ) {
    const guestId = req.user.userId;
    return this.bookingsService.create({
      guestId,
      propertyId: body.propertyId,
      startDate: body.startDate,
      endDate: body.endDate,
      total: body.total,
    });
  }
}
