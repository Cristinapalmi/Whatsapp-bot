-- AlterTable
ALTER TABLE "Episode" ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BannerSlide" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "ctaText" TEXT,
    "ctaKind" TEXT NOT NULL DEFAULT 'NONE',
    "ctaTarget" TEXT,
    "imageKey" TEXT,
    "videoKey" TEXT,
    "videoSec" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BannerSlide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BannerSlide_active_sortOrder_idx" ON "BannerSlide"("active", "sortOrder");


ALTER TABLE "BannerSlide" ENABLE ROW LEVEL SECURITY;

-- Episódios já publicados: data de publicação aproximada (a da série, ou a de criação)
UPDATE "Episode" e SET "publishedAt" = COALESCE(e."submittedAt", s."publishedAt", e."createdAt")
FROM "Series" s WHERE s.id = e."seriesId" AND e.published = true AND e."publishedAt" IS NULL;
