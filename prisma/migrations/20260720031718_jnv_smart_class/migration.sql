-- CreateEnum
CREATE TYPE "JnvFileKind" AS ENUM ('PDF', 'PPT', 'DOC', 'XLS', 'IMAGE', 'AUDIO', 'VIDEO', 'ZIP', 'OTHER');

-- CreateTable
CREATE TABLE "JnvFolder" (
    "id" TEXT NOT NULL,
    "classLevel" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "parentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JnvFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JnvResource" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "classLevel" INTEGER NOT NULL,
    "subject" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "teacherName" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileKind" "JnvFileKind" NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER NOT NULL,
    "thumbnailUrl" TEXT,
    "isAssignment" BOOLEAN NOT NULL DEFAULT false,
    "dueAt" TIMESTAMP(3),
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JnvResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JnvAnnouncement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "classLevel" INTEGER,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JnvAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JnvFolder_classLevel_parentId_idx" ON "JnvFolder"("classLevel", "parentId");

-- CreateIndex
CREATE INDEX "JnvFolder_parentId_idx" ON "JnvFolder"("parentId");

-- CreateIndex
CREATE INDEX "JnvResource_folderId_idx" ON "JnvResource"("folderId");

-- CreateIndex
CREATE INDEX "JnvResource_classLevel_fileKind_idx" ON "JnvResource"("classLevel", "fileKind");

-- CreateIndex
CREATE INDEX "JnvResource_isAssignment_idx" ON "JnvResource"("isAssignment");

-- CreateIndex
CREATE INDEX "JnvResource_createdAt_idx" ON "JnvResource"("createdAt");

-- CreateIndex
CREATE INDEX "JnvAnnouncement_classLevel_idx" ON "JnvAnnouncement"("classLevel");

-- CreateIndex
CREATE INDEX "JnvAnnouncement_pinned_createdAt_idx" ON "JnvAnnouncement"("pinned", "createdAt");

-- AddForeignKey
ALTER TABLE "JnvFolder" ADD CONSTRAINT "JnvFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "JnvFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JnvFolder" ADD CONSTRAINT "JnvFolder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JnvResource" ADD CONSTRAINT "JnvResource_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "JnvFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JnvResource" ADD CONSTRAINT "JnvResource_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JnvAnnouncement" ADD CONSTRAINT "JnvAnnouncement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
