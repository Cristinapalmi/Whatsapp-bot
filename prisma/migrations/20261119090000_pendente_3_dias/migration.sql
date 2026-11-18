-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "availableAt" TIMESTAMP(3),
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "releasedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "JournalEntry_releasedAt_availableAt_idx" ON "JournalEntry"("releasedAt", "availableAt");

