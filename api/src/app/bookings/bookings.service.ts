import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async listBookableProperties() {
    await this.ensureDevSeedProperty();

    return this.prisma.property.findMany({
      select: {
        id: true,
        name: true,
        price: true,
      },
      orderBy: { id: 'asc' },
      take: 100,
    });
  }

  private async ensureDevSeedProperty() {
    const nodeEnv = process.env.NODE_ENV ?? 'development';
    const shouldSeed =
      nodeEnv !== 'production' &&
      (process.env.AUTO_SEED_DEFAULT_PROPERTY ?? 'true').toLowerCase() === 'true';

    if (!shouldSeed) {
      return;
    }

    const hasProperty = await this.prisma.property.findFirst({
      select: { id: true },
    });

    if (hasProperty) {
      return;
    }

    const host = await this.prisma.user.upsert({
      where: { email: 'seed-host@hostpulse.local' },
      update: { role: 'host' },
      create: {
        email: 'seed-host@hostpulse.local',
        // Development-only placeholder hash (not used for auth login)
        hashedPassword: 'seed-placeholder-hash',
        role: 'host',
        name: 'HostPulse Seed Host',
      },
      select: { id: true },
    });

    await this.prisma.property.create({
      data: {
        name: 'HostPulse Starter Property',
        description: 'Auto-seeded property for local booking flow initialization.',
        location: {
          city: 'Nairobi',
          country: 'Kenya',
        },
        amenities: ['wifi', 'parking'],
        photos: [],
        price: 10000,
        hostId: host.id,
      },
    });
  }

  async create(userId: number, propertyId: number, startDate: string, endDate: string, total: number) {
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new BadRequestException('Authenticated user is required');
    }

    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      throw new BadRequestException('propertyId must be a positive integer');
    }

    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }

    if (!Number.isFinite(total) || total <= 0) {
      throw new BadRequestException('total must be a positive number');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('startDate and endDate must be valid ISO dates');
    }
    if (end <= start) {
      throw new BadRequestException('endDate must be after startDate');
    }

    // Check if property exists
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException(`Property with id ${propertyId} does not exist`);
    }

    const overlappingBooking = await this.prisma.booking.findFirst({
      where: {
        propertyId,
        status: {
          in: ['pending', 'confirmed'],
        },
        startDate: {
          lt: end,
        },
        endDate: {
          gt: start,
        },
      },
      select: { id: true },
    });

    if (overlappingBooking) {
      throw new BadRequestException('The selected dates are no longer available for this property.');
    }

    const booking = await this.prisma.booking.create({
      data: {
        userId,
        propertyId,
        startDate: start,
        endDate: end,
        total,
        status: 'pending',
        dates: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
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
