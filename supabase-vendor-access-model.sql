-- PastQ vendor-selected access model
-- Run after the hardened/security and product migrations.

BEGIN;

ALTER TABLE question_banks
  ADD COLUMN IF NOT EXISTS access_type TEXT NOT NULL DEFAULT 'paid'
    CHECK (access_type IN ('free','paid','preview_paid'));

ALTER TABLE question_banks
  ADD COLUMN IF NOT EXISTS preview_count INTEGER NOT NULL DEFAULT 0
    CHECK (preview_count >= 0);

-- Free banks must always have a zero price.
ALTER TABLE question_banks
  ADD CONSTRAINT question_banks_free_price_check
  CHECK (access_type <> 'free' OR price = 0);

-- Paid / preview-paid banks must have a positive price.
ALTER TABLE question_banks
  ADD CONSTRAINT question_banks_paid_price_check
  CHECK (
    access_type = 'free'
    OR price > 0
  );

CREATE INDEX IF NOT EXISTS idx_question_banks_access_type
  ON question_banks(access_type, status);

-- Existing purchasers keep access even if a vendor later changes
-- the bank from paid -> free or free -> paid.
-- Existing purchase rows are the entitlement record.

COMMIT;

-- SECURITY HARDENING: never expose question rows directly through the browser.
-- The server route /api/banks/[id]/questions is the only content gateway.
DROP POLICY IF EXISTS "questions_preview" ON questions;
DROP POLICY IF EXISTS "questions_purchased" ON questions;

-- Vendors may manage their own uploaded questions. Public/student reads are denied.
-- Existing vendor policy remains for the vendor's own rows.

-- SECURITY HARDENING: users must not be able to manufacture successful purchases.
DROP POLICY IF EXISTS "purchases_own" ON purchases;
CREATE POLICY "purchases_read_own" ON purchases
  FOR SELECT USING (auth.uid() = user_id);
-- INSERT/UPDATE/DELETE are intentionally unavailable to browser clients.
-- Server-side Paystack verification uses the service-role client.
