-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserEventType" ADD VALUE 'PAGE_VIEW';
ALTER TYPE "UserEventType" ADD VALUE 'CHECKOUT_START';

-- AlterTable
ALTER TABLE "UserEvent" ADD COLUMN     "device" TEXT,
ADD COLUMN     "referrer" TEXT;

-- CreateIndex
CREATE INDEX "UserEvent_createdAt_idx" ON "UserEvent"("createdAt");
