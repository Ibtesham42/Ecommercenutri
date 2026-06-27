-- CreateEnum
CREATE TYPE "UserEventType" AS ENUM ('PRODUCT_VIEW', 'CATEGORY_VIEW', 'SEARCH', 'CART_ADD', 'WISHLIST_ADD', 'PURCHASE', 'RECO_CLICK', 'CLICK');

-- CreateTable
CREATE TABLE "UserEvent" (
    "id" TEXT NOT NULL,
    "type" "UserEventType" NOT NULL,
    "userId" TEXT,
    "anonId" TEXT,
    "productId" TEXT,
    "categoryId" TEXT,
    "query" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserEvent_type_createdAt_idx" ON "UserEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "UserEvent_productId_type_idx" ON "UserEvent"("productId", "type");

-- CreateIndex
CREATE INDEX "UserEvent_userId_createdAt_idx" ON "UserEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserEvent_categoryId_createdAt_idx" ON "UserEvent"("categoryId", "createdAt");
