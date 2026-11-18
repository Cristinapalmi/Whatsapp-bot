-- AlterTable
ALTER TABLE "PaymentRequest" ADD COLUMN     "ocrText" TEXT,
ADD COLUMN     "proofCheckedAt" TIMESTAMP(3),
ADD COLUMN     "suspicionReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "suspicious" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "paymentsBlockedAt" TIMESTAMP(3),
ADD COLUMN     "paymentsBlockedReason" TEXT;

