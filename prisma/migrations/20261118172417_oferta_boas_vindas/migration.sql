-- AlterTable
ALTER TABLE "PaymentRequest" ADD COLUMN     "bonusCoins" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "welcomeOfferStartedAt" TIMESTAMP(3);
