-- CreateEnum
CREATE TYPE "HospitalityCategory" AS ENUM ('HOTEL', 'LODGE', 'RESORT', 'GUEST_HOUSE', 'SERVICED_APARTMENT', 'AIRBNB', 'TOURS_TRAVEL', 'SAFARI_OPERATOR');

-- CreateTable
CREATE TABLE "HospitalityBusiness" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "category" "HospitalityCategory" NOT NULL,
    "county" TEXT NOT NULL,
    "town" TEXT,
    "area" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "bookingLink" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "description" TEXT,
    "amenities" TEXT[],
    "source" TEXT NOT NULL,
    "sourceRef" TEXT,
    "qualityScore" INTEGER NOT NULL DEFAULT 0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalityBusiness_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HospitalityBusiness_dedupeKey_key" ON "HospitalityBusiness"("dedupeKey");

-- CreateIndex
CREATE INDEX "HospitalityBusiness_county_category_idx" ON "HospitalityBusiness"("county", "category");

-- CreateIndex
CREATE INDEX "HospitalityBusiness_category_idx" ON "HospitalityBusiness"("category");

-- CreateIndex
CREATE INDEX "HospitalityBusiness_normalizedName_idx" ON "HospitalityBusiness"("normalizedName");

-- CreateIndex
CREATE INDEX "HospitalityBusiness_county_town_idx" ON "HospitalityBusiness"("county", "town");

-- CreateIndex
CREATE INDEX "HospitalityBusiness_lastSeenAt_idx" ON "HospitalityBusiness"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalityBusiness_source_sourceRef_key" ON "HospitalityBusiness"("source", "sourceRef");
