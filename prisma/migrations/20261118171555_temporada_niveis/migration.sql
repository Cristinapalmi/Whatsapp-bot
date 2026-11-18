-- AlterTable
ALTER TABLE "CoinSpend" ADD COLUMN     "seriesId" TEXT;

-- AlterTable
ALTER TABLE "Entitlement" ADD COLUMN     "coinSpendId" TEXT;

-- CreateIndex
CREATE INDEX "Entitlement_coinSpendId_idx" ON "Entitlement"("coinSpendId");

-- AddForeignKey
ALTER TABLE "CoinSpend" ADD CONSTRAINT "CoinSpend_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Séries já publicadas antes dos níveis mantêm o preço que tinham (Normal = 20 moedas).
UPDATE "Series" SET "tier" = 'NORMAL' WHERE "status" = 'PUBLISHED' AND "tier" = 'ENTRY';
