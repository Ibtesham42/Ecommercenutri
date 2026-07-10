-- CreateEnum
CREATE TYPE "CompetitorPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "IntelSource" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'YOUTUBE', 'BLOG', 'WEBSITE', 'OTHER');

-- CreateEnum
CREATE TYPE "IntelSignalKind" AS ENUM ('POST', 'REEL', 'CAROUSEL', 'STORY', 'VIDEO', 'BLOG_POST', 'PRODUCT_LAUNCH', 'CAMPAIGN', 'HASHTAG', 'OTHER');

-- CreateEnum
CREATE TYPE "IntelReportKind" AS ENUM ('COMPETITOR_PROFILE', 'MARKET_TRENDS', 'CONTENT_GAPS');

-- CreateEnum
CREATE TYPE "ContentIdeaFormat" AS ENUM ('REEL', 'CAROUSEL', 'STORY', 'POST', 'BLOG');

-- CreateEnum
CREATE TYPE "ContentIdeaDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "ContentIdeaStatus" AS ENUM ('SUGGESTED', 'SHORTLISTED', 'USED', 'DISMISSED');

-- AlterTable
ALTER TABLE "StoreSetting" ADD COLUMN     "intelligence" JSONB;

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Healthy snacks',
    "priority" "CompetitorPriority" NOT NULL DEFAULT 'MEDIUM',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "instagram" TEXT,
    "facebook" TEXT,
    "linkedin" TEXT,
    "website" TEXT,
    "blogUrl" TEXT,
    "notes" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "lastAnalyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorSignal" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "source" "IntelSource" NOT NULL DEFAULT 'INSTAGRAM',
    "kind" "IntelSignalKind" NOT NULL DEFAULT 'POST',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "url" TEXT,
    "postedAt" TIMESTAMP(3),
    "likes" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "views" INTEGER,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceReport" (
    "id" TEXT NOT NULL,
    "kind" "IntelReportKind" NOT NULL,
    "competitorId" TEXT,
    "periodKey" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "model" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntelligenceReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentIdea" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "format" "ContentIdeaFormat" NOT NULL DEFAULT 'POST',
    "difficulty" "ContentIdeaDifficulty" NOT NULL DEFAULT 'MEDIUM',
    "engagementPotential" INTEGER NOT NULL DEFAULT 0,
    "bestTime" TEXT,
    "cta" TEXT,
    "scores" JSONB,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentIdeaStatus" NOT NULL DEFAULT 'SUGGESTED',
    "batchDate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentIdea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Competitor_name_key" ON "Competitor"("name");

-- CreateIndex
CREATE INDEX "Competitor_active_priority_idx" ON "Competitor"("active", "priority");

-- CreateIndex
CREATE INDEX "CompetitorSignal_competitorId_createdAt_idx" ON "CompetitorSignal"("competitorId", "createdAt");

-- CreateIndex
CREATE INDEX "CompetitorSignal_createdAt_idx" ON "CompetitorSignal"("createdAt");

-- CreateIndex
CREATE INDEX "IntelligenceReport_kind_generatedAt_idx" ON "IntelligenceReport"("kind", "generatedAt");

-- CreateIndex
CREATE INDEX "IntelligenceReport_competitorId_idx" ON "IntelligenceReport"("competitorId");

-- CreateIndex
CREATE UNIQUE INDEX "IntelligenceReport_kind_periodKey_key" ON "IntelligenceReport"("kind", "periodKey");

-- CreateIndex
CREATE INDEX "ContentIdea_status_createdAt_idx" ON "ContentIdea"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ContentIdea_batchDate_idx" ON "ContentIdea"("batchDate");

-- CreateIndex
CREATE INDEX "ContentIdea_totalScore_idx" ON "ContentIdea"("totalScore");

-- AddForeignKey
ALTER TABLE "CompetitorSignal" ADD CONSTRAINT "CompetitorSignal_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
