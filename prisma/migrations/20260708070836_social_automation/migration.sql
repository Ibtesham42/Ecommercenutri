-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('INSTAGRAM', 'FACEBOOK');

-- CreateEnum
CREATE TYPE "SocialPostStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SocialContentPillar" AS ENUM ('PRODUCT_KNOWLEDGE', 'HEALTHY_SNACKING', 'TARGET_AUDIENCE', 'WHY_NUTRIYET', 'LIFESTYLE', 'RECIPES', 'COMMUNITY', 'CUSTOMER_STORIES');

-- CreateEnum
CREATE TYPE "SocialDaypart" AS ENUM ('MORNING', 'EVENING');

-- CreateEnum
CREATE TYPE "SocialPublishMode" AS ENUM ('AUTO_PUBLISH', 'MANUAL_APPROVAL', 'DRAFT');

-- AlterTable
ALTER TABLE "StoreSetting" ADD COLUMN     "social" JSONB;

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL DEFAULT 'INSTAGRAM',
    "status" "SocialPostStatus" NOT NULL DEFAULT 'DRAFT',
    "pillar" "SocialContentPillar" NOT NULL,
    "daypart" "SocialDaypart" NOT NULL,
    "weekOfMonth" INTEGER NOT NULL,
    "productId" TEXT,
    "campaignId" TEXT,
    "hook" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "captionLong" TEXT,
    "cta" TEXT NOT NULL,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "altText" TEXT NOT NULL,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contentHash" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "externalId" TEXT,
    "permalink" TEXT,
    "error" TEXT,
    "reach" INTEGER,
    "impressions" INTEGER,
    "likes" INTEGER,
    "comments" INTEGER,
    "clicks" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "platforms" "SocialPlatform"[] DEFAULT ARRAY['INSTAGRAM']::"SocialPlatform"[],
    "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mode" "SocialPublishMode" NOT NULL DEFAULT 'MANUAL_APPROVAL',
    "morningTime" TEXT NOT NULL DEFAULT '09:00',
    "eveningTime" TEXT NOT NULL DEFAULT '18:00',
    "days" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[],
    "maxPerDay" INTEGER NOT NULL DEFAULT 2,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "lastPlannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pillar" "SocialContentPillar" NOT NULL,
    "promptGuidance" TEXT NOT NULL,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "igUserId" TEXT,
    "username" TEXT,
    "pageId" TEXT,
    "connectedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialPost_status_scheduledFor_idx" ON "SocialPost"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "SocialPost_contentHash_idx" ON "SocialPost"("contentHash");

-- CreateIndex
CREATE INDEX "SocialPost_campaignId_idx" ON "SocialPost"("campaignId");

-- CreateIndex
CREATE INDEX "SocialPost_createdAt_idx" ON "SocialPost"("createdAt");

-- CreateIndex
CREATE INDEX "SocialCampaign_enabled_idx" ON "SocialCampaign"("enabled");

-- CreateIndex
CREATE INDEX "SocialCampaign_createdAt_idx" ON "SocialCampaign"("createdAt");

-- CreateIndex
CREATE INDEX "SocialTemplate_pillar_idx" ON "SocialTemplate"("pillar");

-- CreateIndex
CREATE UNIQUE INDEX "SocialTemplate_name_key" ON "SocialTemplate"("name");
