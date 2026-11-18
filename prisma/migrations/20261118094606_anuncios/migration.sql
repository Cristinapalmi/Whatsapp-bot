-- AlterEnum
ALTER TYPE "EntitlementSource" ADD VALUE 'AD';

-- CreateTable
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL,
    "sponsor" TEXT NOT NULL,
    "title" TEXT,
    "videoKey" TEXT,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "linkUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "completions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdView" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AdView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdUnlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "phone" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "adViewId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdRevenue" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "sponsor" TEXT,
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdView_userId_startedAt_idx" ON "AdView"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdUnlock_adViewId_key" ON "AdUnlock"("adViewId");

-- CreateIndex
CREATE INDEX "AdUnlock_phone_idx" ON "AdUnlock"("phone");

-- CreateIndex
CREATE INDEX "AdUnlock_month_artistId_idx" ON "AdUnlock"("month", "artistId");

-- CreateIndex
CREATE INDEX "AdRevenue_month_idx" ON "AdRevenue"("month");

-- AddForeignKey
ALTER TABLE "AdView" ADD CONSTRAINT "AdView_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdView" ADD CONSTRAINT "AdView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdView" ADD CONSTRAINT "AdView_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdUnlock" ADD CONSTRAINT "AdUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdUnlock" ADD CONSTRAINT "AdUnlock_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdUnlock" ADD CONSTRAINT "AdUnlock_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "ArtistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdUnlock" ADD CONSTRAINT "AdUnlock_adViewId_fkey" FOREIGN KEY ("adViewId") REFERENCES "AdView"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Oferta com anúncio: quantas vezes cada conta/telefone pode usar (por defeito 1, para sempre)
INSERT INTO "Setting" ("key", "value", "updatedAt") VALUES ('adOfferLimit', '1', NOW())
ON CONFLICT ("key") DO NOTHING;
