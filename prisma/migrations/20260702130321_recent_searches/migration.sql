-- AlterTable
ALTER TABLE "User" ADD COLUMN     "recentSearches" TEXT[] DEFAULT ARRAY[]::TEXT[];
