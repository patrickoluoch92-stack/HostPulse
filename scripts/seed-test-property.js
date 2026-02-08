require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    const prop = await prisma.property.create({
      data: {
        name: 'E2E Test Property',
        description: 'Created for automated E2E tests',
        location: null,
        amenities: [],
        price: 100.0,
        photos: [],
        hostId: 1,
      },
    });
    console.log('Created property:', prop.id);
  } catch (e) {
    console.error('Seed error:', e.message || e);
    process.exitCode = 1;
  } finally {
    await require('@prisma/client').PrismaClient.prototype.$disconnect?.();
  }
}

main();
