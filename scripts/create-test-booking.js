require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    const booking = await prisma.booking.create({
      data: {
        userId: 1,
        propertyId: 1,
        startDate: new Date('2026-02-10'),
        endDate: new Date('2026-02-12'),
        total: 1000,
        status: 'pending',
      },
    });
    console.log('Created booking:', booking.id);
  } catch (e) {
    console.error('Booking error:', e.message || e);
    process.exitCode = 1;
  } finally {
    try { await prisma.$disconnect(); } catch (e) {}
  }
}

main();
