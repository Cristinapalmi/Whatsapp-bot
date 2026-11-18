-- CreateEnum
CREATE TYPE "EpisodeStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'REJECTED');

-- AlterEnum
ALTER TYPE "SeriesStatus" ADD VALUE 'DRAFT';

-- AlterTable
ALTER TABLE "ArtistProfile" ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT,
ALTER COLUMN "status" SET DEFAULT 'APPROVED';

-- AlterTable
ALTER TABLE "Episode" ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "status" "EpisodeStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- Episódios que já estavam visíveis ficam "Publicados"
UPDATE "Episode" SET "status" = 'PUBLISHED' WHERE "published" = true;

-- Artistas ficam ativos logo no registo: os que estavam à espera passam a ativos
UPDATE "ArtistProfile" SET "status" = 'APPROVED', "approvedAt" = COALESCE("approvedAt", NOW()) WHERE "status" = 'PENDING';
