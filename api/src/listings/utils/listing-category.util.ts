import { ListingCategory } from '@prisma/client';

export function mapGoogleTypesToCategory(types: string[] = []): ListingCategory {
  const normalized = new Set(types.map((t) => t.toLowerCase()));

  if (normalized.has('travel_agency') || normalized.has('tourist_information_center')) {
    return ListingCategory.tour_company;
  }

  if (
    normalized.has('rv_park') ||
    normalized.has('campground') ||
    normalized.has('lodging') ||
    normalized.has('guest_house')
  ) {
    if (normalized.has('resort_hotel')) {
      return ListingCategory.resort;
    }

    if (normalized.has('apartment_hotel') || normalized.has('apartment')) {
      return ListingCategory.airbnb;
    }

    if (normalized.has('campground') || normalized.has('rv_park')) {
      return ListingCategory.lodge;
    }
  }

  return ListingCategory.hotel;
}

export function normalizeCategory(input?: string | null): ListingCategory {
  const value = String(input || '')
    .trim()
    .toLowerCase();

  if (value === 'tour_company' || value === 'tour-company' || value === 'tour') {
    return ListingCategory.tour_company;
  }
  if (value === 'airbnb' || value === 'apartment' || value === 'vacation_rental') {
    return ListingCategory.airbnb;
  }
  if (value === 'resort') {
    return ListingCategory.resort;
  }
  if (value === 'lodge' || value === 'camp' || value === 'campground') {
    return ListingCategory.lodge;
  }
  return ListingCategory.hotel;
}

