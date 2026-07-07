-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "badge" TEXT,
ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "nutritionImageUrl" TEXT;
