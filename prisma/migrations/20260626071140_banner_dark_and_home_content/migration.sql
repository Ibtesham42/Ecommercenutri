-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "desktopImageDark" TEXT,
ADD COLUMN     "mobileImageDark" TEXT;

-- AlterTable
ALTER TABLE "HomeSection" ADD COLUMN     "content" JSONB;
