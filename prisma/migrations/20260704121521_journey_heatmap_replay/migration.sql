-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserEventType" ADD VALUE 'HOME_VIEW';
ALTER TYPE "UserEventType" ADD VALUE 'PAYMENT_START';
ALTER TYPE "UserEventType" ADD VALUE 'RAGE_CLICK';

-- AlterTable
ALTER TABLE "UserEvent" ADD COLUMN     "city" TEXT,
ADD COLUMN     "path" TEXT,
ADD COLUMN     "region" TEXT;

-- CreateTable
CREATE TABLE "HeatStat" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "page" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "hovers" INTEGER NOT NULL DEFAULT 0,
    "timeMs" INTEGER NOT NULL DEFAULT 0,
    "scroll25" INTEGER NOT NULL DEFAULT 0,
    "scroll50" INTEGER NOT NULL DEFAULT 0,
    "scroll75" INTEGER NOT NULL DEFAULT 0,
    "scroll100" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HeatStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionRecording" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "anonId" TEXT,
    "device" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "pages" JSONB NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "rageCount" INTEGER NOT NULL DEFAULT 0,
    "reachedCheckout" BOOLEAN NOT NULL DEFAULT false,
    "purchased" BOOLEAN NOT NULL DEFAULT false,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SessionRecording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HeatStat_day_idx" ON "HeatStat"("day");

-- CreateIndex
CREATE UNIQUE INDEX "HeatStat_day_page_section_device_key" ON "HeatStat"("day", "page", "section", "device");

-- CreateIndex
CREATE INDEX "SessionRecording_startedAt_idx" ON "SessionRecording"("startedAt");
