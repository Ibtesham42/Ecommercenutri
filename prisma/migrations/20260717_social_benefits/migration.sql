-- Additive: on-image benefit badges for the premium creative engine
-- (lib/social/creative). IF NOT EXISTS because this was applied to Neon
-- through the pooled connection (the dev machine cannot reach DIRECT_URL), so
-- `migrate deploy` may re-run it.
ALTER TABLE "SocialPost" ADD COLUMN IF NOT EXISTS "benefits" TEXT[] NOT NULL DEFAULT '{}';
