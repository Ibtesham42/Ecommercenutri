-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'REPLIED', 'CLOSED');

-- AlterTable
ALTER TABLE "ContactMessage" ADD COLUMN     "status" "ContactStatus" NOT NULL DEFAULT 'NEW';

-- CreateTable
CREATE TABLE "ContactReply" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "adminId" TEXT,
    "adminName" TEXT,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactReply_messageId_idx" ON "ContactReply"("messageId");

-- CreateIndex
CREATE INDEX "ContactMessage_status_idx" ON "ContactMessage"("status");

-- AddForeignKey
ALTER TABLE "ContactReply" ADD CONSTRAINT "ContactReply_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ContactMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
