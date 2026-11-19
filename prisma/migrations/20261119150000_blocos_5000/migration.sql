-- AlterTable
ALTER TABLE "ArtistProfile" ADD COLUMN     "lastAvailableBlock" INTEGER NOT NULL DEFAULT 0;


-- Levantamento mínimo passa a 5.000 Kz (primeiro e seguintes), se o admin tinha gravado outro valor
UPDATE "Setting" SET "value" = '5000', "updatedAt" = now() WHERE "key" IN ('payoutFirstMinKz', 'payoutMinKz') AND "value" <> '5000';
