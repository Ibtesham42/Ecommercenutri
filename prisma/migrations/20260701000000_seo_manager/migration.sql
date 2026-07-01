-- Extended SEO / social-share / verification / analytics config (admin-managed).
-- Single additive nullable JSON column; existing SEO columns are untouched.
ALTER TABLE "StoreSetting" ADD COLUMN "seo" JSONB;
