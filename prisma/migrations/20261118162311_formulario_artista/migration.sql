-- CreateEnum
CREATE TYPE "AgeRating" AS ENUM ('ALL', 'AGE13', 'AGE16', 'AGE18');

-- CreateEnum
CREATE TYPE "PriceTier" AS ENUM ('ENTRY', 'NORMAL', 'PREMIUM');

-- AlterTable
ALTER TABLE "Series" ADD COLUMN     "ageRating" "AgeRating" NOT NULL DEFAULT 'ALL',
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'PT',
ADD COLUMN     "purgedAt" TIMESTAMP(3),
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tier" "PriceTier" NOT NULL DEFAULT 'ENTRY',
ADD COLUMN     "withdrawReason" TEXT,
ADD COLUMN     "withdrawnAt" TIMESTAMP(3);
