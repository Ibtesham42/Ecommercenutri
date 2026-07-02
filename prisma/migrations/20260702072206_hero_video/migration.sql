-- AlterTable
ALTER TABLE "HeroSlide" ADD COLUMN     "videoMeta" JSONB,
ADD COLUMN     "videoPoster" TEXT,
ADD COLUMN     "videoQuality" TEXT NOT NULL DEFAULT 'balanced';
