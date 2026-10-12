-- Spin & Win eligibility verification (additive only).
-- A campaign can't go live until an admin verifies its exact variant IDs and
-- sizes against the live catalogue; existing campaigns start unverified, so
-- nothing becomes playable by applying this migration.
ALTER TABLE "SpinCampaign" ADD COLUMN     "eligibilitySnapshot" JSONB,
ADD COLUMN     "eligibilityVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "eligibilityVerifiedById" TEXT;
