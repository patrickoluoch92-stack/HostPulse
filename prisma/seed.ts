import 'dotenv/config';
import { ListingCategory, PrismaClient, SourceType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required for seeding');
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

type SeedListing = {
  name: string;
  category: ListingCategory;
  address: string;
  city: string;
  county: string;
  latitude: number;
  longitude: number;
  rating: number;
  ratingCount: number;
  phone?: string;
  websiteUrl?: string;
};

const listings: SeedListing[] = [
  { name: 'Sarova Stanley', category: ListingCategory.hotel, address: 'Kimathi St, Nairobi', city: 'Nairobi', county: 'Nairobi', latitude: -1.2834, longitude: 36.8219, rating: 4.6, ratingCount: 2410, websiteUrl: 'https://www.sarovahotels.com/stanley-nairobi/' },
  { name: 'Villa Rosa Kempinski', category: ListingCategory.hotel, address: 'Chiromo Rd, Nairobi', city: 'Nairobi', county: 'Nairobi', latitude: -1.2716, longitude: 36.8138, rating: 4.7, ratingCount: 2980, websiteUrl: 'https://www.kempinski.com/en/hotel-villa-rosa' },
  { name: 'Fairmont The Norfolk', category: ListingCategory.hotel, address: 'Harry Thuku Rd, Nairobi', city: 'Nairobi', county: 'Nairobi', latitude: -1.2766, longitude: 36.8152, rating: 4.5, ratingCount: 1840 },
  { name: 'Argyle Grand Hotel Nairobi Airport', category: ListingCategory.hotel, address: 'Mombasa Rd, Nairobi', city: 'Nairobi', county: 'Nairobi', latitude: -1.3199, longitude: 36.9169, rating: 4.5, ratingCount: 1120 },
  { name: 'PrideInn Paradise Beach Resort', category: ListingCategory.resort, address: 'Shanzu Beach, Mombasa', city: 'Mombasa', county: 'Mombasa', latitude: -3.9705, longitude: 39.7436, rating: 4.5, ratingCount: 3670 },
  { name: 'Serena Beach Resort & Spa', category: ListingCategory.resort, address: 'Shanzu, Mombasa', city: 'Mombasa', county: 'Mombasa', latitude: -3.9513, longitude: 39.7441, rating: 4.6, ratingCount: 2950 },
  { name: 'Swahili Beach Resort', category: ListingCategory.resort, address: 'Diani Beach Rd, Diani', city: 'Ukunda', county: 'Kwale', latitude: -4.3095, longitude: 39.5792, rating: 4.6, ratingCount: 2210 },
  { name: 'Leopard Beach Resort', category: ListingCategory.resort, address: 'Diani Beach, Ukunda', city: 'Ukunda', county: 'Kwale', latitude: -4.3038, longitude: 39.5757, rating: 4.5, ratingCount: 1980 },
  { name: 'Enashipai Resort & Spa', category: ListingCategory.resort, address: 'Moi South Lake Rd, Naivasha', city: 'Naivasha', county: 'Nakuru', latitude: -0.7256, longitude: 36.4326, rating: 4.5, ratingCount: 1740 },
  { name: 'Muthu Keekorok Lodge', category: ListingCategory.lodge, address: 'Masai Mara Reserve', city: 'Narok', county: 'Narok', latitude: -1.4921, longitude: 35.2535, rating: 4.4, ratingCount: 1320 },
  { name: 'Mara Serena Safari Lodge', category: ListingCategory.lodge, address: 'Masai Mara National Reserve', city: 'Narok', county: 'Narok', latitude: -1.4068, longitude: 35.0083, rating: 4.6, ratingCount: 1460 },
  { name: 'Sarova Lion Hill Game Lodge', category: ListingCategory.lodge, address: 'Lake Nakuru National Park', city: 'Nakuru', county: 'Nakuru', latitude: -0.3327, longitude: 36.0867, rating: 4.5, ratingCount: 1210 },
  { name: 'Lake Naivasha Sopa Resort', category: ListingCategory.resort, address: 'Moi South Lake Rd, Naivasha', city: 'Naivasha', county: 'Nakuru', latitude: -0.7707, longitude: 36.398, rating: 4.4, ratingCount: 1550 },
  { name: 'Acacia Premier Hotel', category: ListingCategory.hotel, address: 'Achieng Oneko Rd, Kisumu', city: 'Kisumu', county: 'Kisumu', latitude: -0.1006, longitude: 34.7522, rating: 4.4, ratingCount: 940 },
  { name: 'Sirikwa Hotel', category: ListingCategory.hotel, address: 'Oloo St, Eldoret', city: 'Eldoret', county: 'Uasin Gishu', latitude: 0.5204, longitude: 35.2698, rating: 4.2, ratingCount: 680 },
  { name: 'Airbnb Westlands Skyline Apartment', category: ListingCategory.airbnb, address: 'Westlands, Nairobi', city: 'Nairobi', county: 'Nairobi', latitude: -1.2675, longitude: 36.8047, rating: 4.7, ratingCount: 210 },
  { name: 'Airbnb Kilimani Executive Studio', category: ListingCategory.airbnb, address: 'Kilimani, Nairobi', city: 'Nairobi', county: 'Nairobi', latitude: -1.2921, longitude: 36.7878, rating: 4.6, ratingCount: 167 },
  { name: 'Airbnb Nyali Ocean View Suite', category: ListingCategory.airbnb, address: 'Nyali, Mombasa', city: 'Mombasa', county: 'Mombasa', latitude: -4.0459, longitude: 39.6935, rating: 4.6, ratingCount: 143 },
  { name: 'Bonfire Adventures', category: ListingCategory.tour_company, address: 'Muthithi Rd, Nairobi', city: 'Nairobi', county: 'Nairobi', latitude: -1.2642, longitude: 36.8103, rating: 4.3, ratingCount: 820, websiteUrl: 'https://www.bonfireadventures.com' },
  { name: 'Pollman\'s Tours and Safaris', category: ListingCategory.tour_company, address: 'Moktar Daddah St, Nairobi', city: 'Nairobi', county: 'Nairobi', latitude: -1.2845, longitude: 36.8235, rating: 4.2, ratingCount: 510, websiteUrl: 'https://www.pollmans.com' },
  { name: 'Natural World Kenya Safaris', category: ListingCategory.tour_company, address: 'Mombasa Rd, Nairobi', city: 'Nairobi', county: 'Nairobi', latitude: -1.3182, longitude: 36.8548, rating: 4.5, ratingCount: 420 },
  { name: 'Bountiful Safaris', category: ListingCategory.tour_company, address: 'Moi Ave, Mombasa', city: 'Mombasa', county: 'Mombasa', latitude: -4.0624, longitude: 39.6682, rating: 4.4, ratingCount: 330 },
];

async function main() {
  for (const item of listings) {
    const sourcePlaceId = `seed-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const source = await prisma.source.upsert({
      where: {
        type_providerPlaceId: {
          type: SourceType.google_places,
          providerPlaceId: sourcePlaceId,
        },
      },
      update: {
        query: 'seed: kenyan-hospitality-listings',
        rawTypes: [item.category],
        rating: item.rating,
        ratingCount: item.ratingCount,
      },
      create: {
        type: SourceType.google_places,
        provider: 'seed',
        providerPlaceId: sourcePlaceId,
        query: 'seed: kenyan-hospitality-listings',
        rawTypes: [item.category],
        rating: item.rating,
        ratingCount: item.ratingCount,
      },
    });

    const listing = await prisma.listing.findFirst({
      where: {
        OR: [{ name: item.name }, { sources: { some: { id: source.id } } }],
      },
      include: { location: true },
    });

    if (listing) {
      await prisma.listing.update({
        where: { id: listing.id },
        data: {
          name: item.name,
          category: item.category,
          description: `${item.category} listing in ${item.city}, Kenya`,
          phone: item.phone ?? null,
          websiteUrl: item.websiteUrl ?? null,
          ratingAvg: item.rating,
          ratingCount: item.ratingCount,
          location: {
            update: {
              name: item.name,
              addressLine1: item.address,
              city: item.city,
              county: item.county,
              country: 'Kenya',
              latitude: item.latitude,
              longitude: item.longitude,
            },
          },
          sources: {
            connect: [{ id: source.id }],
          },
        },
      });
    } else {
      await prisma.listing.create({
        data: {
          name: item.name,
          category: item.category,
          description: `${item.category} listing in ${item.city}, Kenya`,
          phone: item.phone ?? null,
          websiteUrl: item.websiteUrl ?? null,
          ratingAvg: item.rating,
          ratingCount: item.ratingCount,
          location: {
            create: {
              name: item.name,
              addressLine1: item.address,
              city: item.city,
              county: item.county,
              country: 'Kenya',
              latitude: item.latitude,
              longitude: item.longitude,
            },
          },
          sources: {
            connect: [{ id: source.id }],
          },
        },
      });
    }
  }

  const total = await prisma.listing.count();
  console.log(`Seed complete. Total listings in database: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

