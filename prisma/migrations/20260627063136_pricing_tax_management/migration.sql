-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "deliveryCharge" INTEGER,
ADD COLUMN     "gstRate" INTEGER;

-- AlterTable
ALTER TABLE "StoreSetting" ADD COLUMN     "defaultGstRate" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "defaultShippingFee" INTEGER NOT NULL DEFAULT 4900,
ADD COLUMN     "freeShippingThreshold" INTEGER NOT NULL DEFAULT 49900,
ADD COLUMN     "gstin" TEXT;
