-- CreateEnum
CREATE TYPE "AutomationLogStatus" AS ENUM ('SENT', 'PARTIAL', 'FAILED', 'TEST');

-- AlterTable
ALTER TABLE "AutomationLog" ADD COLUMN     "channels" "CampaignChannel"[] DEFAULT ARRAY[]::"CampaignChannel"[],
ADD COLUMN     "detail" JSONB,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "status" "AutomationLogStatus" NOT NULL DEFAULT 'SENT';

-- CreateIndex
CREATE INDEX "AutomationLog_createdAt_idx" ON "AutomationLog"("createdAt");
