-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('RAZORPAY', 'COD');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "codFee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'RAZORPAY',
ADD COLUMN     "stockDeducted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StoreSetting" ADD COLUMN     "codEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "codMaxOrder" INTEGER,
ADD COLUMN     "codMinOrder" INTEGER,
ADD COLUMN     "codPincodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sellerName" TEXT NOT NULL,
    "sellerAddress" TEXT,
    "sellerGstin" TEXT,
    "sellerEmail" TEXT,
    "sellerPhone" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orderId_key" ON "Invoice"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_seq_key" ON "Invoice"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
