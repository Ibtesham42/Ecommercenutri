-- CreateEnum
CREATE TYPE "AffiliateRole" AS ENUM ('INFLUENCER', 'AFFILIATE', 'BRAND_AMBASSADOR', 'NUTRITIONIST', 'GYM_PARTNER', 'BLOGGER', 'YOUTUBE_CREATOR', 'INSTAGRAM_CREATOR');

-- CreateEnum
CREATE TYPE "AffiliateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommissionScope" AS ENUM ('ROLE', 'PRODUCT', 'CATEGORY');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PROCESSING', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('UPI', 'BANK_TRANSFER', 'RAZORPAYX');

-- CreateEnum
CREATE TYPE "MarketingAssetType" AS ENUM ('PRODUCT_IMAGE', 'BANNER', 'LOGO', 'PDF', 'SOCIAL_CREATIVE', 'STORY_TEMPLATE', 'REEL_ASSET', 'VIDEO', 'CATALOGUE');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'AFFILIATE_UPDATE';

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "categoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "affiliateId" TEXT,
ADD COLUMN     "referralCode" TEXT;

-- AlterTable
ALTER TABLE "StoreSetting" ADD COLUMN     "affiliateCookieDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "affiliateDefaultCommissionType" "CommissionType" NOT NULL DEFAULT 'PERCENT',
ADD COLUMN     "affiliateDefaultCommissionValue" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "affiliateEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "affiliateMinPayout" INTEGER NOT NULL DEFAULT 50000;

-- CreateTable
CREATE TABLE "Affiliate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AffiliateRole" NOT NULL DEFAULT 'AFFILIATE',
    "status" "AffiliateStatus" NOT NULL DEFAULT 'PENDING',
    "code" TEXT NOT NULL,
    "couponId" TEXT,
    "commissionType" "CommissionType",
    "commissionValue" INTEGER,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "website" TEXT,
    "socials" JSONB,
    "audienceSize" INTEGER,
    "pitch" TEXT,
    "payoutMethod" "PayoutMethod",
    "upiId" TEXT,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "bankIfsc" TEXT,
    "accountName" TEXT,
    "rejectionReason" TEXT,
    "suspendReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Affiliate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateClick" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "anonId" TEXT,
    "userId" TEXT,
    "landingPath" TEXT NOT NULL,
    "referrer" TEXT,
    "device" TEXT,
    "browser" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "scope" "CommissionScope" NOT NULL,
    "role" "AffiliateRole",
    "productId" TEXT,
    "categoryId" TEXT,
    "type" "CommissionType" NOT NULL DEFAULT 'PERCENT',
    "value" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "base" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "matureAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "payoutId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "payoutNumber" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "method" "PayoutMethod",
    "reference" TEXT,
    "notes" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAsset" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "MarketingAssetType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "fileType" TEXT,
    "sizeBytes" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_userId_key" ON "Affiliate"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_code_key" ON "Affiliate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_couponId_key" ON "Affiliate"("couponId");

-- CreateIndex
CREATE INDEX "Affiliate_status_idx" ON "Affiliate"("status");

-- CreateIndex
CREATE INDEX "Affiliate_role_idx" ON "Affiliate"("role");

-- CreateIndex
CREATE INDEX "AffiliateClick_affiliateId_idx" ON "AffiliateClick"("affiliateId");

-- CreateIndex
CREATE INDEX "AffiliateClick_affiliateId_anonId_idx" ON "AffiliateClick"("affiliateId", "anonId");

-- CreateIndex
CREATE INDEX "CommissionRule_scope_idx" ON "CommissionRule"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionRule_scope_role_productId_categoryId_key" ON "CommissionRule"("scope", "role", "productId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_orderId_key" ON "Commission"("orderId");

-- CreateIndex
CREATE INDEX "Commission_affiliateId_idx" ON "Commission"("affiliateId");

-- CreateIndex
CREATE INDEX "Commission_status_idx" ON "Commission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_payoutNumber_key" ON "Payout"("payoutNumber");

-- CreateIndex
CREATE INDEX "Payout_affiliateId_idx" ON "Payout"("affiliateId");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE INDEX "MarketingAsset_isActive_idx" ON "MarketingAsset"("isActive");

-- CreateIndex
CREATE INDEX "Order_affiliateId_idx" ON "Order"("affiliateId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateClick" ADD CONSTRAINT "AffiliateClick_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
