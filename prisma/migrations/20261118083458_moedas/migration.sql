-- AlterEnum
ALTER TYPE "EntitlementSource" ADD VALUE 'COINS';

-- AlterEnum
ALTER TYPE "PaymentKind" ADD VALUE 'COINS';

-- AlterTable
ALTER TABLE "PaymentRequest" ADD COLUMN     "coinPackId" TEXT,
ADD COLUMN     "coins" INTEGER;

-- AlterTable
ALTER TABLE "Series" ADD COLUMN     "priceCoins" INTEGER,
ALTER COLUMN "freeEpisodes" SET DEFAULT 3;

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "CoinPack" (
    "id" TEXT NOT NULL,
    "priceKz" INTEGER NOT NULL,
    "coins" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftType" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "priceCoins" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GiftType_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "CoinLot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentRequestId" TEXT NOT NULL,
    "coinsTotal" INTEGER NOT NULL,
    "coinsRemaining" INTEGER NOT NULL,
    "valueCents" INTEGER NOT NULL,
    "valueRemainingCents" INTEGER NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinSpend" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "episodeId" TEXT,
    "giftCode" TEXT,
    "artistId" TEXT NOT NULL,
    "coins" INTEGER NOT NULL,
    "valueCents" INTEGER NOT NULL,
    "artistCents" INTEGER NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinSpend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinSpendAllocation" (
    "id" TEXT NOT NULL,
    "spendId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "coins" INTEGER NOT NULL,
    "valueCents" INTEGER NOT NULL,

    CONSTRAINT "CoinSpendAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "userId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("userId","seriesId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoinLot_paymentRequestId_key" ON "CoinLot"("paymentRequestId");

-- CreateIndex
CREATE INDEX "CoinLot_userId_createdAt_idx" ON "CoinLot"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CoinSpend_userId_createdAt_idx" ON "CoinSpend"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CoinSpend_artistId_createdAt_idx" ON "CoinSpend"("artistId", "createdAt");

-- CreateIndex
CREATE INDEX "CoinSpendAllocation_lotId_idx" ON "CoinSpendAllocation"("lotId");

-- AddForeignKey
ALTER TABLE "CoinLot" ADD CONSTRAINT "CoinLot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinSpend" ADD CONSTRAINT "CoinSpend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinSpend" ADD CONSTRAINT "CoinSpend_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinSpend" ADD CONSTRAINT "CoinSpend_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "ArtistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinSpendAllocation" ADD CONSTRAINT "CoinSpendAllocation_spendId_fkey" FOREIGN KEY ("spendId") REFERENCES "CoinSpend"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinSpendAllocation" ADD CONSTRAINT "CoinSpendAllocation_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "CoinLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Valores iniciais (editáveis depois no admin)
-- ============================================================

-- Preço por defeito de um episódio: 20 moedas
INSERT INTO "Setting" ("key", "value", "updatedAt") VALUES ('episodePriceCoins', '20', NOW())
ON CONFLICT ("key") DO NOTHING;

-- Pacotes de moedas
INSERT INTO "CoinPack" ("id", "priceKz", "coins", "active", "sortOrder", "createdAt") VALUES
  ('pack_1000', 1000, 100, true, 1, NOW()),
  ('pack_2000', 2000, 220, true, 2, NOW()),
  ('pack_5000', 5000, 575, true, 3, NOW()),
  ('pack_10000', 10000, 1200, true, 4, NOW())
ON CONFLICT ("id") DO NOTHING;

-- Presentes (sem marcas reais)
INSERT INTO "GiftType" ("code", "label", "emoji", "priceCoins", "active", "sortOrder") VALUES
  ('MIMO', 'Mimo', '💝', 10, true, 1),
  ('KANDANDU', 'Kandandu', '🤗', 50, true, 2),
  ('ESTRELA', 'Estrela', '⭐', 100, true, 3),
  ('COROA', 'Coroa', '👑', 500, true, 4)
ON CONFLICT ("code") DO NOTHING;

-- ============================================================
-- 3 episódios grátis em todas as séries
-- O "gancho" que estava no último episódio grátis antigo (n.º 2) passa para o n.º 3,
-- se a série tiver episódio 3 e este ainda não tiver gancho.
-- ============================================================
UPDATE "Episode" e3
SET "endsWithHook" = true, "hookText" = COALESCE(e3."hookText", e2."hookText")
FROM "Episode" e2, "Series" s
WHERE e2."seriesId" = s.id AND e3."seriesId" = s.id
  AND s."freeEpisodes" = 2 AND e2."number" = 2 AND e2."endsWithHook" = true
  AND e3."number" = 3 AND e3."endsWithHook" = false;

UPDATE "Episode" e2
SET "endsWithHook" = false
FROM "Series" s
WHERE e2."seriesId" = s.id AND s."freeEpisodes" = 2 AND e2."number" = 2
  AND EXISTS (SELECT 1 FROM "Episode" e3 WHERE e3."seriesId" = s.id AND e3."number" = 3);

UPDATE "Series" SET "freeEpisodes" = 3;
