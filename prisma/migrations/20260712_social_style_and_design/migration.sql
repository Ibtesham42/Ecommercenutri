-- Additive: content-style rotation + on-image design metadata for AI Marketing.
-- IF NOT EXISTS because this was applied to Neon through the pooled connection
-- (the dev machine cannot reach DIRECT_URL), so `migrate deploy` may re-run it.
ALTER TABLE "SocialPost" ADD COLUMN IF NOT EXISTS "styleKey" TEXT;
ALTER TABLE "SocialPost" ADD COLUMN IF NOT EXISTS "headline" TEXT;
ALTER TABLE "SocialPost" ADD COLUMN IF NOT EXISTS "designKey" TEXT;
