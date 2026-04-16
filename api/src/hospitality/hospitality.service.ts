import { Injectable } from '@nestjs/common';
import { HospitalityCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface HospitalitySearchInput {
  county?: string;
  category?: string;
  q?: string;
  page: number;
  pageSize: number;
}

const CATEGORY_ALIASES: Record<string, HospitalityCategory> = {
  hotel: HospitalityCategory.HOTEL,
  hotels: HospitalityCategory.HOTEL,
  lodge: HospitalityCategory.LODGE,
  lodges: HospitalityCategory.LODGE,
  resort: HospitalityCategory.RESORT,
  resorts: HospitalityCategory.RESORT,
  guesthouse: HospitalityCategory.GUEST_HOUSE,
  'guest house': HospitalityCategory.GUEST_HOUSE,
  'guest-house': HospitalityCategory.GUEST_HOUSE,
  apartment: HospitalityCategory.SERVICED_APARTMENT,
  apartments: HospitalityCategory.SERVICED_APARTMENT,
  'serviced apartment': HospitalityCategory.SERVICED_APARTMENT,
  serviced: HospitalityCategory.SERVICED_APARTMENT,
  airbnb: HospitalityCategory.AIRBNB,
  tours: HospitalityCategory.TOURS_TRAVEL,
  travel: HospitalityCategory.TOURS_TRAVEL,
  'tours and travel': HospitalityCategory.TOURS_TRAVEL,
  safari: HospitalityCategory.SAFARI_OPERATOR,
  safaris: HospitalityCategory.SAFARI_OPERATOR,
};

@Injectable()
export class HospitalityService {
  constructor(private readonly prisma: PrismaService) {}

  resolveCategory(input?: string): HospitalityCategory | undefined {
    if (!input) {
      return undefined;
    }

    const normalized = input.trim().toLowerCase();
    return (
      CATEGORY_ALIASES[normalized] ??
      (Object.values(HospitalityCategory).find((value) => value === input.toUpperCase()) as
        | HospitalityCategory
        | undefined)
    );
  }

  async search(input: HospitalitySearchInput) {
    const where: Prisma.HospitalityBusinessWhereInput = {
      isActive: true,
    };

    if (input.county?.trim()) {
      where.county = {
        equals: input.county.trim(),
        mode: 'insensitive',
      };
    }

    const category = this.resolveCategory(input.category);
    if (category) {
      where.category = category;
    }

    if (input.q?.trim()) {
      const q = input.q.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { town: { contains: q, mode: 'insensitive' } },
        { area: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const skip = (input.page - 1) * input.pageSize;
    const [total, items] = await this.prisma.$transaction([
      this.prisma.hospitalityBusiness.count({ where }),
      this.prisma.hospitalityBusiness.findMany({
        where,
        skip,
        take: input.pageSize,
        orderBy: [{ qualityScore: 'desc' }, { name: 'asc' }],
      }),
    ]);

    return {
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      items,
    };
  }

  async stats() {
    const [total, byCategory, byCounty] = await this.prisma.$transaction([
      this.prisma.hospitalityBusiness.count({ where: { isActive: true } }),
      this.prisma.hospitalityBusiness.groupBy({
        by: ['category'],
        where: { isActive: true },
        _count: { _all: true },
        orderBy: { _count: { category: 'desc' } },
      }),
      this.prisma.hospitalityBusiness.groupBy({
        by: ['county'],
        where: { isActive: true },
        _count: { _all: true },
        orderBy: { _count: { county: 'desc' } },
      }),
    ]);

    return {
      total,
      byCategory: byCategory.map((entry) => ({
        category: entry.category,
        count: typeof entry._count === 'object' ? (entry._count._all ?? 0) : 0,
      })),
      byCounty: byCounty.map((entry) => ({
        county: entry.county,
        count: typeof entry._count === 'object' ? (entry._count._all ?? 0) : 0,
      })),
    };
  }
}
