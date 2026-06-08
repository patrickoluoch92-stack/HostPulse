import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ListingCategory, SourceType } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GooglePlacesTextSearchResponse,
  GooglePlacesTextSearchResult,
} from '../models/google-places.model';
import { mapGoogleTypesToCategory, normalizeCategory } from '../utils/listing-category.util';

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);
  private readonly googleBaseUrl = 'https://maps.googleapis.com/maps/api/place';
  private readonly kenyaQueries = [
    'hotels in Kenya',
    'lodges in Maasai Mara',
    'tour companies Nairobi',
  ];

  constructor(private readonly prisma: PrismaService) {}

  async getAll(args: { category?: string; page?: number; limit?: number }) {
    const page = args.page && args.page > 0 ? args.page : 1;
    const limit = args.limit && args.limit > 0 ? Math.min(args.limit, 100) : 20;

    const category =
      args.category && Object.values(ListingCategory).includes(args.category as ListingCategory)
        ? (args.category as ListingCategory)
        : undefined;

    const where = category ? { category } : {};
    const [items, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        include: {
          location: true,
          sources: true,
          media: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.listing.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  async getNearby(args: { lat?: number; lng?: number; radiusKm: number }) {
    if (typeof args.lat !== 'number' || Number.isNaN(args.lat)) {
      throw new BadRequestException('lat is required');
    }
    if (typeof args.lng !== 'number' || Number.isNaN(args.lng)) {
      throw new BadRequestException('lng is required');
    }

    const radiusKm = Math.max(0.5, Math.min(args.radiusKm || 5, 100));
    const radiusDegrees = radiusKm / 111;

    const candidates = await this.prisma.listing.findMany({
      where: {
        location: {
          latitude: { gte: args.lat - radiusDegrees, lte: args.lat + radiusDegrees },
          longitude: { gte: args.lng - radiusDegrees, lte: args.lng + radiusDegrees },
        },
      },
      include: { location: true, sources: true, media: true },
      take: 300,
    });

    const withDistance = candidates
      .map((item) => {
        const distanceKm = this.haversineKm(
          args.lat as number,
          args.lng as number,
          item.location.latitude,
          item.location.longitude,
        );
        return { ...item, distanceKm };
      })
      .filter((item) => item.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return { items: withDistance, total: withDistance.length };
  }

  async getById(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { location: true, sources: true, reviews: true, media: true },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    return listing;
  }

  async create(body: any, createdByUserId?: number) {
    if (!body?.name) {
      throw new BadRequestException('name is required');
    }
    if (typeof body?.latitude !== 'number' || typeof body?.longitude !== 'number') {
      throw new BadRequestException('latitude and longitude are required');
    }

    const category = normalizeCategory(body?.category);
    this.validateCoordinates(body.latitude, body.longitude);

    const baseData = {
      name: this.cleanName(body.name),
      category,
      description: this.cleanText(body.description),
      phone: this.cleanPhone(body.phone),
      websiteUrl: this.cleanUrl(body.websiteUrl),
      location: {
        create: {
          name: this.cleanText(body.locationName),
          addressLine1: this.cleanText(body.addressLine1),
          city: this.cleanText(body.city),
          county: this.cleanText(body.county),
          country: this.cleanText(body.country) || 'Kenya',
          latitude: body.latitude,
          longitude: body.longitude,
        },
      },
    };

    return this.prisma.listing.create({
      data: {
        ...baseData,
        ...(createdByUserId ? { createdByUser: { connect: { id: createdByUserId } } } : {}),
      },
      include: { location: true },
    });
  }

  async ingestFromGooglePlaces() {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Google Places ingestion is unavailable because GOOGLE_PLACES_API_KEY is not configured',
      );
    }

    const summary = {
      queries: this.kenyaQueries,
      fetched: 0,
      upsertedSources: 0,
      createdListings: 0,
      updatedListings: 0,
      skippedWithoutCoordinates: 0,
      errors: [] as string[],
    };

    for (const query of this.kenyaQueries) {
      try {
        const places = await this.searchPlaces(apiKey, query);
        summary.fetched += places.length;

        for (const place of places) {
          const lat = place.geometry?.location?.lat;
          const lng = place.geometry?.location?.lng;
          if (typeof lat !== 'number' || typeof lng !== 'number') {
            summary.skippedWithoutCoordinates += 1;
            continue;
          }

          const upsertResult = await this.upsertGooglePlace(place, query);
          summary.upsertedSources += 1;
          if (upsertResult === 'created') {
            summary.createdListings += 1;
          } else {
            summary.updatedListings += 1;
          }
        }
      } catch (error: any) {
        this.logger.error(`Google ingestion failed for query "${query}": ${error.message}`);
        summary.errors.push(`${query}: ${error.message}`);
      }
    }

    return summary;
  }

  async refreshListingRatingsFromSources() {
    const listings = await this.prisma.listing.findMany({
      include: {
        sources: {
          where: { rating: { not: null } },
          select: { rating: true, ratingCount: true },
        },
      },
      take: 5000,
    });

    let updated = 0;
    for (const listing of listings) {
      if (!listing.sources.length) {
        continue;
      }

      let weightedTotal = 0;
      let totalVotes = 0;
      for (const source of listing.sources) {
        const rating = source.rating ?? 0;
        const votes = Math.max(1, source.ratingCount ?? 1);
        weightedTotal += rating * votes;
        totalVotes += votes;
      }

      const ratingAvg = totalVotes > 0 ? Number((weightedTotal / totalVotes).toFixed(2)) : null;
      const ratingCount = totalVotes > 0 ? totalVotes : null;

      await this.prisma.listing.update({
        where: { id: listing.id },
        data: { ratingAvg, ratingCount },
      });
      updated += 1;
    }

    return { scanned: listings.length, updated };
  }

  async claimListing(id: string, userId: number, message?: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.claimedByUserId && listing.claimedByUserId !== userId) {
      throw new ForbiddenException('Listing already claimed by another user');
    }

    const claimNote = this.cleanText(message);
    return this.prisma.listing.update({
      where: { id },
      data: {
        claimedByUser: { connect: { id: userId } },
        verificationNote: claimNote ?? listing.verificationNote,
      },
      include: { location: true, sources: true, media: true },
    });
  }

  async verifyListing(
    id: string,
    userId: number,
    role: string | undefined,
    isVerified: boolean,
    verificationNote?: string,
  ) {
    if (role !== 'host' && role !== 'admin') {
      throw new ForbiddenException('Only host/admin users can verify listings');
    }

    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return this.prisma.listing.update({
      where: { id },
      data: {
        isVerified,
        verifiedByUser: { connect: { id: userId } },
        verificationNote: this.cleanText(verificationNote),
      },
      include: { location: true, sources: true, media: true },
    });
  }

  private async searchPlaces(apiKey: string, query: string): Promise<GooglePlacesTextSearchResult[]> {
    const url = `${this.googleBaseUrl}/textsearch/json`;
    const response = await axios.get<GooglePlacesTextSearchResponse>(url, {
      params: {
        query,
        key: apiKey,
      },
      timeout: 20000,
    });

    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      const message = response.data.error_message || `Google status: ${response.data.status}`;
      throw new BadGatewayException(`Google Places API error: ${message}`);
    }

    return response.data.results ?? [];
  }

  private async upsertGooglePlace(
    place: GooglePlacesTextSearchResult,
    query: string,
  ): Promise<'created' | 'updated'> {
    const category = mapGoogleTypesToCategory(place.types ?? []);
    const latitude = place.geometry?.location?.lat as number;
    const longitude = place.geometry?.location?.lng as number;
    this.validateCoordinates(latitude, longitude);

    const name = this.cleanName(place.name);
    const address = this.cleanText(place.formatted_address);
    const phone = this.cleanPhone(place.international_phone_number || place.formatted_phone_number);
    const website = this.cleanUrl(place.website);

    const existingSource = await this.prisma.source.findUnique({
      where: {
        type_providerPlaceId: {
          type: SourceType.google_places,
          providerPlaceId: place.place_id,
        },
      },
      include: { listing: { include: { location: true } } },
    });

    if (existingSource?.listing) {
      await this.prisma.listing.update({
        where: { id: existingSource.listing.id },
        data: {
          name,
          category,
          phone,
          websiteUrl: website,
          ratingAvg: place.rating ?? null,
          ratingCount: place.user_ratings_total ?? null,
          description: address,
          location: {
            update: {
              name,
              addressLine1: address,
              city: this.extractCity(address),
              county: this.extractCounty(address),
              country: 'Kenya',
              latitude,
              longitude,
            },
          },
        },
      });

      await this.prisma.source.update({
        where: { id: existingSource.id },
        data: {
          query,
          rawTypes: place.types ?? [],
          rating: place.rating ?? null,
          ratingCount: place.user_ratings_total ?? null,
        },
      });

      await this.upsertPhotos(existingSource.listing.id, place.photos ?? []);
      return 'updated';
    }

    const duplicateCandidate = await this.findDuplicateCandidate({
      name,
      latitude,
      longitude,
      category,
    });

    if (duplicateCandidate) {
      await this.prisma.listing.update({
        where: { id: duplicateCandidate.id },
        data: {
          category,
          phone: phone ?? duplicateCandidate.phone,
          websiteUrl: website ?? duplicateCandidate.websiteUrl,
          ratingAvg: place.rating ?? duplicateCandidate.ratingAvg,
          ratingCount: place.user_ratings_total ?? duplicateCandidate.ratingCount,
          description: address ?? duplicateCandidate.description,
          location: {
            update: {
              name,
              addressLine1: address ?? duplicateCandidate.location.addressLine1,
              city: this.extractCity(address) ?? duplicateCandidate.location.city,
              county: this.extractCounty(address) ?? duplicateCandidate.location.county,
              country: 'Kenya',
              latitude,
              longitude,
            },
          },
          sources: {
            create: {
              type: SourceType.google_places,
              provider: 'google',
              providerPlaceId: place.place_id,
              query,
              rawTypes: place.types ?? [],
              rating: place.rating ?? null,
              ratingCount: place.user_ratings_total ?? null,
            },
          },
        },
      });

      await this.upsertPhotos(duplicateCandidate.id, place.photos ?? []);
      return 'updated';
    }

    const created = await this.prisma.listing.create({
      data: {
        name,
        category,
        description: address,
        phone,
        websiteUrl: website,
        ratingAvg: place.rating ?? null,
        ratingCount: place.user_ratings_total ?? null,
        location: {
          create: {
            name,
            addressLine1: address,
            city: this.extractCity(address),
            county: this.extractCounty(address),
            country: 'Kenya',
            latitude,
            longitude,
          },
        },
        sources: {
          create: {
            type: SourceType.google_places,
            provider: 'google',
            providerPlaceId: place.place_id,
            query,
            rawTypes: place.types ?? [],
            rating: place.rating ?? null,
            ratingCount: place.user_ratings_total ?? null,
          },
        },
      },
    });

    await this.upsertPhotos(created.id, place.photos ?? []);
    return 'created';
  }

  private async upsertPhotos(
    listingId: string,
    photos: Array<{ photo_reference: string }>,
  ): Promise<void> {
    if (!photos.length) {
      return;
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return;
    }

    for (let idx = 0; idx < Math.min(photos.length, 5); idx += 1) {
      const ref = photos[idx]?.photo_reference;
      if (!ref) {
        continue;
      }
      const photoUrl =
        `${this.googleBaseUrl}/photo?maxwidth=1280` +
        `&photoreference=${encodeURIComponent(ref)}` +
        `&key=${encodeURIComponent(apiKey)}`;

      await this.prisma.media.upsert({
        where: { id: `${listingId}-${idx}-${ref}` },
        update: { url: photoUrl, providerPhotoRef: ref, sortOrder: idx, type: 'image' },
        create: {
          id: `${listingId}-${idx}-${ref}`,
          listingId,
          url: photoUrl,
          providerPhotoRef: ref,
          sortOrder: idx,
          type: 'image',
        },
      });
    }
  }

  private extractCity(address: string | null): string | null {
    if (!address) {
      return null;
    }
    const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) {
      return null;
    }
    return parts[parts.length - 2] || null;
  }

  private extractCounty(address: string | null): string | null {
    if (!address) {
      return null;
    }
    const lowered = address.toLowerCase();
    if (lowered.includes('nairobi')) return 'Nairobi';
    if (lowered.includes('mombasa')) return 'Mombasa';
    if (lowered.includes('nakuru')) return 'Nakuru';
    if (lowered.includes('kisumu')) return 'Kisumu';
    if (lowered.includes('uasin gishu')) return 'Uasin Gishu';
    return null;
  }

  private cleanName(name: string): string {
    const cleaned = String(name || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) {
      throw new BadRequestException('Listing name is required');
    }
    return cleaned;
  }

  private cleanText(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    const cleaned = String(value)
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned ? cleaned : null;
  }

  private cleanPhone(value: unknown): string | null {
    const raw = this.cleanText(value);
    if (!raw) {
      return null;
    }
    const normalized = raw.replace(/[^\d+]/g, '');
    return normalized || null;
  }

  private cleanUrl(value: unknown): string | null {
    const raw = this.cleanText(value);
    if (!raw) {
      return null;
    }
    try {
      const parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
      return parsed.toString();
    } catch {
      return null;
    }
  }

  private validateCoordinates(latitude: number, longitude: number): void {
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new BadRequestException('Invalid latitude/longitude coordinates');
    }
  }

  private normalizeNameForMatch(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private diceCoefficient(a: string, b: string): number {
    if (a === b) {
      return 1;
    }
    if (a.length < 2 || b.length < 2) {
      return 0;
    }

    const toBigrams = (s: string): string[] => {
      const out: string[] = [];
      for (let i = 0; i < s.length - 1; i += 1) out.push(s.slice(i, i + 2));
      return out;
    };

    const aBigrams = toBigrams(a);
    const bBigrams = toBigrams(b);
    const bMap = new Map<string, number>();
    for (const bg of bBigrams) {
      bMap.set(bg, (bMap.get(bg) || 0) + 1);
    }

    let intersection = 0;
    for (const bg of aBigrams) {
      const count = bMap.get(bg) || 0;
      if (count > 0) {
        intersection += 1;
        bMap.set(bg, count - 1);
      }
    }

    return (2 * intersection) / (aBigrams.length + bBigrams.length);
  }

  private async findDuplicateCandidate(args: {
    name: string;
    latitude: number;
    longitude: number;
    category: ListingCategory;
  }) {
    const radiusKm = 0.35;
    const radiusDegrees = radiusKm / 111;
    const candidates = await this.prisma.listing.findMany({
      where: {
        category: args.category,
        location: {
          latitude: { gte: args.latitude - radiusDegrees, lte: args.latitude + radiusDegrees },
          longitude: { gte: args.longitude - radiusDegrees, lte: args.longitude + radiusDegrees },
        },
      },
      include: { location: true },
      take: 50,
    });

    const targetName = this.normalizeNameForMatch(args.name);
    for (const candidate of candidates) {
      const candidateName = this.normalizeNameForMatch(candidate.name);
      const similarity = this.diceCoefficient(targetName, candidateName);
      const distanceKm = this.haversineKm(
        args.latitude,
        args.longitude,
        candidate.location.latitude,
        candidate.location.longitude,
      );

      if (similarity >= 0.8 && distanceKm <= radiusKm) {
        return candidate;
      }
    }

    return null;
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return 6371 * c;
  }
}

