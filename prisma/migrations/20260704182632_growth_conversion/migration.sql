-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserEventType" ADD VALUE 'QUIZ_START';
ALTER TYPE "UserEventType" ADD VALUE 'QUIZ_COMPLETE';
ALTER TYPE "UserEventType" ADD VALUE 'QUIZ_SIGNUP';
ALTER TYPE "UserEventType" ADD VALUE 'COUPON_CLAIM';
ALTER TYPE "UserEventType" ADD VALUE 'POPUP_VIEW';
ALTER TYPE "UserEventType" ADD VALUE 'POPUP_CONVERT';
ALTER TYPE "UserEventType" ADD VALUE 'STICKY_CLICK';

-- AlterTable
ALTER TABLE "StoreSetting" ADD COLUMN     "growth" JSONB;

-- CreateTable
CREATE TABLE "HealthQuizResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "anonId" TEXT,
    "score" INTEGER NOT NULL,
    "band" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "couponCode" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthQuizResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthQuizResult_userId_idx" ON "HealthQuizResult"("userId");

-- CreateIndex
CREATE INDEX "HealthQuizResult_anonId_idx" ON "HealthQuizResult"("anonId");

-- CreateIndex
CREATE INDEX "HealthQuizResult_createdAt_idx" ON "HealthQuizResult"("createdAt");

-- AddForeignKey
ALTER TABLE "HealthQuizResult" ADD CONSTRAINT "HealthQuizResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
