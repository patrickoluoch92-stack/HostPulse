import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async create(data: { guestId: number; propertyId: number; startDate: string; endDate: string; total: number }) {
    const { guestId, propertyId, startDate, endDate, total } = data;

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (start < now) {
      throw new BadRequestException('Start date cannot be in the past');
    }

    if (end <= start) {
      throw new BadRequestException('End date must be after start date');
    }

    // Check if property exists
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Query overlap directly in the database for scalability.
    const overlappingBooking = await this.prisma.booking.findFirst({
      where: {
        propertyId,
        status: {
          in: ['pending', 'confirmed'],
        },
        AND: [
          { startDate: { lt: end } },
          { endDate: { gt: start } },
        ],
      },
      select: { id: true },
    });

    if (overlappingBooking) {
      throw new BadRequestException('Property is not available for the selected dates');
    }

    // Calculate commission (optional, can be set later)
    const commission = total * 0.15; // 15% default commission

    // Create booking
    const booking = await this.prisma.booking.create({
      data: {
        userId: guestId,
        propertyId,
        startDate: start,
        endDate: end,
        total,
        commission,
        dates: {
          start: startDate,
          end: endDate,
        },
        status: 'pending',
      },
      include: {
        property: {
          include: {
            host: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            name: true,
          },
        },
      },
    });

    return booking;
  }
}
