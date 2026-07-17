-- Additive: on-image subhead text (lib/social/creative) was rendered into the
-- image but never persisted, so an admin editing the headline later had no
-- stored `support` value to recompose from. IF NOT EXISTS because this is
-- applied to Neon through the pooled connection, so `migrate deploy` may
-- safely re-run it.
ALTER TABLE "SocialPost" ADD COLUMN IF NOT EXISTS "support" TEXT;
