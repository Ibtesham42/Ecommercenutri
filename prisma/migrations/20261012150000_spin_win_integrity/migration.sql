-- Spin & Win integrity (additive only; safe to apply before or after the code).
-- Constant defaults: metadata-only on Postgres 11+, no table rewrite.

-- Per-line share of a Spin & Win order discount (GST allocation + refunds). 0 = none.
ALTER TABLE "OrderItem" ADD COLUMN     "discount" INTEGER NOT NULL DEFAULT 0;

-- Spin & Win discount attributed to returned units (deducted from the refund). 0 = none.
ALTER TABLE "ReturnRequestItem" ADD COLUMN     "discount" INTEGER NOT NULL DEFAULT 0;

-- Original product when a won offer was moved to another approved product at claim time.
ALTER TABLE "SpinResult" ADD COLUMN     "reassignedFromProductId" TEXT;
