-- AlterTable
ALTER TABLE "PointsTransaction" ADD COLUMN     "refKey" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "inviteCode" TEXT,
ADD COLUMN     "pointsBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "signupDeviceId" TEXT,
ADD COLUMN     "signupIp" TEXT;

-- CreateTable
CREATE TABLE "FanInvite" (
    "id" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "deviceId" TEXT,
    "ip" TEXT,
    "firstWatchAt" TIMESTAMP(3),
    "firstWatchDay" TEXT,
    "returnedAt" TIMESTAMP(3),
    "validatedAt" TIMESTAMP(3),
    "purchaseBonusAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FanInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FanInvite_inviteeId_key" ON "FanInvite"("inviteeId");

-- CreateIndex
CREATE INDEX "FanInvite_inviterId_status_idx" ON "FanInvite"("inviterId", "status");

-- CreateIndex
CREATE INDEX "FanInvite_status_createdAt_idx" ON "FanInvite"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PointsTransaction_refKey_key" ON "PointsTransaction"("refKey");

-- CreateIndex
CREATE UNIQUE INDEX "User_inviteCode_key" ON "User"("inviteCode");

-- AddForeignKey
ALTER TABLE "FanInvite" ADD CONSTRAINT "FanInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanInvite" ADD CONSTRAINT "FanInvite_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "FanInvite" ENABLE ROW LEVEL SECURITY;
