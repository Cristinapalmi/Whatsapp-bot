-- DropForeignKey
ALTER TABLE "AdUnlock" DROP CONSTRAINT "AdUnlock_adViewId_fkey";

-- AlterTable
ALTER TABLE "AdUnlock" ALTER COLUMN "adViewId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "AdUnlock" ADD CONSTRAINT "AdUnlock_adViewId_fkey" FOREIGN KEY ("adViewId") REFERENCES "AdView"("id") ON DELETE SET NULL ON UPDATE CASCADE;
