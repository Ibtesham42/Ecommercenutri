-- Phone-OTP auth + profile completion fields.

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "phoneVerified" TIMESTAMP(3);

-- Normalize legacy free-text phone values to +91XXXXXXXXXX so OTP logins
-- (which always store the normalized form) link to existing accounts:
--   * strip every non-digit
--   * 10 digits            -> +91 + digits
--   * 12 digits with 91    -> +   + digits
--   * anything else        -> NULL (unparseable; user re-verifies in Profile)
UPDATE "User"
SET "phone" = CASE
  WHEN length(regexp_replace("phone", '\D', '', 'g')) = 10
    THEN '+91' || regexp_replace("phone", '\D', '', 'g')
  WHEN length(regexp_replace("phone", '\D', '', 'g')) = 12
   AND regexp_replace("phone", '\D', '', 'g') LIKE '91%'
    THEN '+' || regexp_replace("phone", '\D', '', 'g')
  ELSE NULL
END
WHERE "phone" IS NOT NULL;

-- Dedupe: if two accounts normalized to the same phone, keep it on the oldest
-- account and clear the rest (unique index below would otherwise fail).
UPDATE "User" u
SET "phone" = NULL
WHERE "phone" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "User" older
    WHERE older."phone" = u."phone"
      AND older."createdAt" < u."createdAt"
  );

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
