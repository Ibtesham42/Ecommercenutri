-- AlterTable
ALTER TABLE "StoreSetting" ADD COLUMN     "showcase3dEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ShowcaseItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tagline" TEXT,
    "image" TEXT NOT NULL,
    "imagePng" TEXT,
    "productId" TEXT,
    "ctaText" TEXT,
    "ctaUrl" TEXT,
    "animation" TEXT NOT NULL DEFAULT 'float',
    "background" TEXT NOT NULL DEFAULT 'aurora',
    "rotationSpeed" INTEGER NOT NULL DEFAULT 50,
    "floatIntensity" INTEGER NOT NULL DEFAULT 50,
    "zoom" INTEGER NOT NULL DEFAULT 50,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShowcaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShowcaseItem_isActive_idx" ON "ShowcaseItem"("isActive");

-- AddForeignKey
ALTER TABLE "ShowcaseItem" ADD CONSTRAINT "ShowcaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
