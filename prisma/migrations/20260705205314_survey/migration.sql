-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "ageGroup" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "occupation" TEXT NOT NULL,
    "occupationOther" TEXT,
    "city" TEXT,
    "snackFrequency" TEXT NOT NULL,
    "snacks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "snacksOther" TEXT,
    "snackPriority" TEXT NOT NULL,
    "makhanaEaten" TEXT NOT NULL,
    "makhanaAware" TEXT NOT NULL,
    "makhanaForms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "makhanaBarriers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "makhanaBarrierOther" TEXT,
    "buyPlaces" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "packSize" TEXT NOT NULL,
    "flavours" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "flavourOther" TEXT,
    "learnInterest" TEXT NOT NULL,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "wantsUpdates" TEXT NOT NULL,
    "contactName" TEXT,
    "contactMobile" TEXT,
    "contactEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SurveyResponse_createdAt_idx" ON "SurveyResponse"("createdAt");
