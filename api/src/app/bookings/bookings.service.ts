import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, propertyId: number, startDate: string, endDate: string, total: number) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    if (end <= start) {
      throw new BadRequestException('End date must be after start date');
    }
    if (start < new Date()) {
      throw new BadRequestException('Start date cannot be in the past');
    }

    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const booking = await this.prisma.booking.create({
      data: {
        userId,
        propertyId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        total,
        status: 'pending',
      },
      include: {
        property: true,
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    return booking;
  }
}
