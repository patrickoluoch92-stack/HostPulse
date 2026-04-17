import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsInt, IsISO8601, IsNumber, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { BookingsService } from './bookings.service';

class CreateBookingDto {
  @IsInt()
  @Type(() => Number)
  propertyId!: number;

  @IsISO8601()
  startDate!: string;

  @IsISO8601()
  endDate!: string;

  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  total!: number;
}

@Controller('bookings')
@UseGuards(AuthGuard('jwt'))
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Post()
  async create(@Request() req: any, @Body() dto: CreateBookingDto) {
    const userId: number = req.user?.id ?? req.user?.userId ?? req.user?.sub;
    return this.bookingsService.create(
      userId,
      dto.propertyId,
      dto.startDate,
      dto.endDate,
      dto.total,
    );
  }
}
