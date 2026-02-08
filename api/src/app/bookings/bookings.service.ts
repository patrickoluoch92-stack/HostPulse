import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, propertyId: number, startDate: string, endDate: string, total: number) {
    // debug: log inputs to diagnose undefined propertyId
    // debug logs removed
    // Check if property exists
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
