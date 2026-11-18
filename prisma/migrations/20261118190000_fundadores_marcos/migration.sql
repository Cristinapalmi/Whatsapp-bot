-- AlterTable
ALTER TABLE "ArtistProfile" ADD COLUMN     "firstSaleAt" TIMESTAMP(3),
ADD COLUMN     "founderNumber" INTEGER,
ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "invitedByArtistId" TEXT,
ADD COLUMN     "referralBonusPaidAt" TIMESTAMP(3),
ADD COLUMN     "tiktokUrl" TEXT;

-- AlterTable
ALTER TABLE "Series" ADD COLUMN     "crownedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SeriesMilestone" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "bonusCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeriesMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeriesMilestone_seriesId_kind_threshold_key" ON "SeriesMilestone"("seriesId", "kind", "threshold");

-- CreateIndex
CREATE INDEX "Follow_artistId_idx" ON "Follow"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_userId_artistId_key" ON "Follow"("userId", "artistId");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistProfile_founderNumber_key" ON "ArtistProfile"("founderNumber");

-- AddForeignKey
ALTER TABLE "SeriesMilestone" ADD CONSTRAINT "SeriesMilestone_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "ArtistProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Segurança: as tabelas novas também ficam fechadas ao acesso público do Supabase
ALTER TABLE "SeriesMilestone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Follow" ENABLE ROW LEVEL SECURITY;

-- Artistas Fundadores: os primeiros 20 artistas já registados recebem o seu número
UPDATE "ArtistProfile" a SET "founderNumber" = f.n
FROM (SELECT id, row_number() OVER (ORDER BY "createdAt", id) AS n FROM "ArtistProfile" WHERE status = 'APPROVED') f
WHERE a.id = f.id AND f.n <= 20;
