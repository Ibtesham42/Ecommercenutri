-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippingSaved" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StoreSetting" ADD COLUMN     "codFee" INTEGER,
ADD COLUMN     "expressDeliveryFee" INTEGER,
ADD COLUMN     "freeShippingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "localDeliveryFee" INTEGER;
