const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

dotenv.config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is missing. Set it in .env before running db:check.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: ['error', 'warn'],
  });

  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startedAt;
    console.log(`[db:check] Connected to PostgreSQL successfully (latency ${latencyMs}ms).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[db:check] Database connectivity check failed: ${message}`);
  process.exit(1);
});
