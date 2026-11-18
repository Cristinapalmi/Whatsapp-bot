-- AlterTable
ALTER TABLE "ArtistProfile" ADD COLUMN     "achievementsSeenAt" TIMESTAMP(3),
ADD COLUMN     "notifyEachUnlock" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ArtistGoal" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "thresholdKz" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtistGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArtistGoal_artistId_thresholdKz_key" ON "ArtistGoal"("artistId", "thresholdKz");

-- AddForeignKey
ALTER TABLE "ArtistGoal" ADD CONSTRAINT "ArtistGoal_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "ArtistProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "ArtistGoal" ENABLE ROW LEVEL SECURITY;
