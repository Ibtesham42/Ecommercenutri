-- CreateEnum
CREATE TYPE "B2BStatus" AS ENUM ('NEW', 'IN_REVIEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'CLOSED');

-- CreateTable
CREATE TABLE "B2BInquiry" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "companyName" TEXT,
    "businessType" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "purpose" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "B2BStatus" NOT NULL DEFAULT 'NEW',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "B2BInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "B2BInquiry_status_idx" ON "B2BInquiry"("status");

-- CreateIndex
CREATE INDEX "B2BInquiry_businessType_idx" ON "B2BInquiry"("businessType");

-- CreateIndex
CREATE INDEX "B2BInquiry_createdAt_idx" ON "B2BInquiry"("createdAt");
