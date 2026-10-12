-- CreateEnum
CREATE TYPE "CouponSaleMode" AS ENUM ('STACK', 'BEST_OF', 'EXCLUDE');

-- CreateEnum
CREATE TYPE "SpinStatus" AS ENUM ('AWARDED', 'CLAIMED', 'REDEEMED', 'EXPIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserEventType" ADD VALUE 'SPIN_ENTRY';
ALTER TYPE "UserEventType" ADD VALUE 'SPIN_START';
ALTER TYPE "UserEventType" ADD VALUE 'SPIN_WIN';
ALTER TYPE "UserEventType" ADD VALUE 'SPIN_AUTH';
ALTER TYPE "UserEventType" ADD VALUE 'SPIN_CLAIM';
ALTER TYPE "UserEventType" ADD VALUE 'SPIN_REDEEM';

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "ownerUserId" TEXT,
ADD COLUMN     "saleMode" "CouponSaleMode" NOT NULL DEFAULT 'STACK',
ADD COLUMN     "variantIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "SpinCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "prizes" JSONB NOT NULL,
    "eligibleVariantIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minStock" INTEGER NOT NULL DEFAULT 5,
    "weightCap" INTEGER NOT NULL DEFAULT 200,
    "claimWindowHours" INTEGER NOT NULL DEFAULT 24,
    "offerValidDays" INTEGER NOT NULL DEFAULT 7,
    "maxClaims" INTEGER,
    "claimCount" INTEGER NOT NULL DEFAULT 0,
    "minOrder" INTEGER,
    "maxDiscount" INTEGER,
    "saleMode" "CouponSaleMode" NOT NULL DEFAULT 'BEST_OF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpinCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpinResult" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT,
    "tokenHash" TEXT,
    "anonId" TEXT,
    "percent" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "variantIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SpinStatus" NOT NULL DEFAULT 'AWARDED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "couponId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpinResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SpinResult_tokenHash_key" ON "SpinResult"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "SpinResult_couponId_key" ON "SpinResult"("couponId");

-- CreateIndex
CREATE INDEX "SpinResult_campaignId_status_idx" ON "SpinResult"("campaignId", "status");

-- CreateIndex
CREATE INDEX "SpinResult_createdAt_idx" ON "SpinResult"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SpinResult_campaignId_userId_key" ON "SpinResult"("campaignId", "userId");

-- CreateIndex
CREATE INDEX "Coupon_ownerUserId_idx" ON "Coupon"("ownerUserId");

-- AddForeignKey
ALTER TABLE "SpinResult" ADD CONSTRAINT "SpinResult_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SpinCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpinResult" ADD CONSTRAINT "SpinResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpinResult" ADD CONSTRAINT "SpinResult_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

