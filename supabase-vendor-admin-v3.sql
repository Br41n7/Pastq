-- ═══════════════════════════════════════════════════════════════════════════
-- PastQ v3 — Vendor dashboard, copyright agreement, admin moderation, payouts
-- Run AFTER: schema, hardening v2, product migration, vendor-access-model.
-- Safe to re-run (idempotent) EXCEPT the one-time payout reservation block,
-- which is guarded and only runs the first time.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Profile columns ─────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS vendor_terms_version     TEXT,
  ADD COLUMN IF NOT EXISTS vendor_terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vendor_status            TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS bio                      TEXT;

DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_vendor_status_check
    CHECK (vendor_status IN ('active','suspended'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Helper functions ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_active_vendor(uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = uid
      AND role = 'vendor'
      AND vendor_status = 'active'
      AND vendor_terms_accepted_at IS NOT NULL
  );
$$;

-- ── 3. Lock system-owned profile fields ────────────────────────────────────
-- Before this, policy "profiles_own" (FOR ALL) let any user UPDATE their own
-- role, total_earnings and pending_payout straight from the browser.
DROP POLICY IF EXISTS "profiles_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
-- No browser INSERT/DELETE: profiles are created by the signup trigger.

CREATE OR REPLACE FUNCTION protect_profile_system_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND auth.uid() IS NOT NULL THEN
    -- Only self-service role change: student -> vendor (signup flow).
    IF NEW.role IS DISTINCT FROM OLD.role
       AND NOT (OLD.role = 'student' AND NEW.role = 'vendor') THEN
      RAISE EXCEPTION 'Role can only be changed by an administrator';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.email IS DISTINCT FROM OLD.email
      OR NEW.total_earnings IS DISTINCT FROM OLD.total_earnings
      OR NEW.total_paid_out IS DISTINCT FROM OLD.total_paid_out
      OR NEW.pending_payout IS DISTINCT FROM OLD.pending_payout
      OR NEW.paystack_subaccount IS DISTINCT FROM OLD.paystack_subaccount
      OR NEW.vendor_status IS DISTINCT FROM OLD.vendor_status
      OR NEW.vendor_terms_version IS DISTINCT FROM OLD.vendor_terms_version
      OR NEW.vendor_terms_accepted_at IS DISTINCT FROM OLD.vendor_terms_accepted_at
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Protected profile fields can only be changed by the server';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_system_fields_trigger ON profiles;
CREATE TRIGGER protect_profile_system_fields_trigger
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION protect_profile_system_fields();

-- ── 4. Copyright / permission agreement (append-only audit record) ─────────
CREATE TABLE IF NOT EXISTS vendor_agreements (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vendor_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  version       TEXT NOT NULL,
  declarations  JSONB NOT NULL,
  signed_name   TEXT NOT NULL,
  ip_address    TEXT,
  user_agent    TEXT,
  accepted_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vendor_agreements_vendor ON vendor_agreements(vendor_id, accepted_at DESC);
ALTER TABLE vendor_agreements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agreements_read_own" ON vendor_agreements;
CREATE POLICY "agreements_read_own" ON vendor_agreements FOR SELECT USING (auth.uid() = vendor_id);
-- Writes: server only (service role).

-- ── 5. Payout account (private — NOT on the publicly-readable profiles table)
CREATE TABLE IF NOT EXISTS vendor_payout_accounts (
  vendor_id      UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  bank_name      TEXT NOT NULL,
  account_number TEXT NOT NULL CHECK (account_number ~ '^[0-9]{10}$'),
  account_name   TEXT NOT NULL,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE vendor_payout_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payout_acct_select_own" ON vendor_payout_accounts;
DROP POLICY IF EXISTS "payout_acct_insert_own" ON vendor_payout_accounts;
DROP POLICY IF EXISTS "payout_acct_update_own" ON vendor_payout_accounts;
CREATE POLICY "payout_acct_select_own" ON vendor_payout_accounts FOR SELECT USING (auth.uid() = vendor_id);
CREATE POLICY "payout_acct_insert_own" ON vendor_payout_accounts FOR INSERT
  WITH CHECK (auth.uid() = vendor_id AND is_active_vendor(auth.uid()));
CREATE POLICY "payout_acct_update_own" ON vendor_payout_accounts FOR UPDATE
  USING (auth.uid() = vendor_id AND is_active_vendor(auth.uid()))
  WITH CHECK (auth.uid() = vendor_id);

-- ── 6. Question-bank moderation fields + gated vendor policies ─────────────
ALTER TABLE question_banks
  ADD COLUMN IF NOT EXISTS moderation_note TEXT,
  ADD COLUMN IF NOT EXISTS moderated_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderated_at    TIMESTAMPTZ;

-- Insert: must have accepted the agreement, be active, and start as pending
-- with zeroed marketplace stats (vendors could previously insert status='live').
DROP POLICY IF EXISTS "banks_vendor_insert" ON question_banks;
CREATE POLICY "banks_vendor_insert" ON question_banks FOR INSERT
WITH CHECK (
  auth.uid() = vendor_id
  AND is_active_vendor(auth.uid())
  AND status = 'pending'
  AND total_sales = 0 AND rating = 0 AND rating_count = 0
);

DROP POLICY IF EXISTS "banks_vendor_update" ON question_banks;
CREATE POLICY "banks_vendor_update" ON question_banks FOR UPDATE
USING (auth.uid() = vendor_id AND is_active_vendor(auth.uid()))
WITH CHECK (auth.uid() = vendor_id);

-- Delete: only unsold, unpublished banks (deleting a sold bank would cascade-
-- delete purchase records and buyers' entitlements).
DROP POLICY IF EXISTS "banks_vendor_delete" ON question_banks;
CREATE POLICY "banks_vendor_delete" ON question_banks FOR DELETE
USING (auth.uid() = vendor_id AND status IN ('pending','rejected') AND total_sales = 0);

-- Protected-field trigger: add moderation fields + allow trusted DB triggers
-- (via a transaction-local flag) to maintain question_count / status.
CREATE OR REPLACE FUNCTION protect_question_bank_system_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('pastq.system_update', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND auth.uid() IS NOT NULL THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.vendor_id IS DISTINCT FROM OLD.vendor_id
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.total_sales IS DISTINCT FROM OLD.total_sales
      OR NEW.rating IS DISTINCT FROM OLD.rating
      OR NEW.rating_count IS DISTINCT FROM OLD.rating_count
      OR NEW.question_count IS DISTINCT FROM OLD.question_count
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.moderation_note IS DISTINCT FROM OLD.moderation_note
      OR NEW.moderated_by IS DISTINCT FROM OLD.moderated_by
      OR NEW.moderated_at IS DISTINCT FROM OLD.moderated_at
    THEN
      RAISE EXCEPTION 'Protected question-bank fields can only be changed by the server';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 7. Questions: gated vendor writes, auto count, re-review on edit ───────
DROP POLICY IF EXISTS "questions_vendor_insert" ON questions;
CREATE POLICY "questions_vendor_insert" ON questions FOR INSERT
WITH CHECK (
  auth.uid() = vendor_id
  AND is_active_vendor(auth.uid())
  AND EXISTS (SELECT 1 FROM question_banks b WHERE b.id = bank_id AND b.vendor_id = auth.uid())
);

DROP POLICY IF EXISTS "questions_vendor_update" ON questions;
CREATE POLICY "questions_vendor_update" ON questions FOR UPDATE
USING (auth.uid() = vendor_id AND is_active_vendor(auth.uid()))
WITH CHECK (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "questions_vendor_delete" ON questions;
CREATE POLICY "questions_vendor_delete" ON questions FOR DELETE
USING (auth.uid() = vendor_id AND is_active_vendor(auth.uid()));

-- Keep question_count accurate; if a VENDOR changes the content of a live bank
-- it goes back to pending review (same rule as commercial edits in v2).
-- Admin/service-role edits (auth.uid() IS NULL) never unpublish a bank.
CREATE OR REPLACE FUNCTION sync_bank_after_question_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bank UUID := COALESCE(NEW.bank_id, OLD.bank_id);
BEGIN
  PERFORM set_config('pastq.system_update', 'on', true);
  UPDATE question_banks SET
    question_count = (SELECT COUNT(*) FROM questions WHERE bank_id = v_bank),
    status = CASE WHEN auth.uid() IS NOT NULL AND status = 'live' THEN 'pending' ELSE status END
  WHERE id = v_bank;
  PERFORM set_config('pastq.system_update', 'off', true);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_bank_after_question_change_trigger ON questions;
CREATE TRIGGER sync_bank_after_question_change_trigger
AFTER INSERT OR UPDATE OR DELETE ON questions
FOR EACH ROW EXECUTE FUNCTION sync_bank_after_question_change();

-- ── 8. Reports: admin review fields ────────────────────────────────────────
ALTER TABLE content_reports
  ADD COLUMN IF NOT EXISTS admin_note  TEXT,
  ADD COLUMN IF NOT EXISTS resolution  TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE content_reports ADD CONSTRAINT content_reports_resolution_check
    CHECK (resolution IS NULL OR resolution IN ('fixed','removed','bank_taken_down','no_action'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE content_reports ADD CONSTRAINT content_reports_details_len
    CHECK (details IS NULL OR char_length(details) <= 1000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_reports_question ON content_reports(question_id);
-- Reporters can already insert/select their own reports (product migration).
-- Admin access is via the service-role client in /api/admin/*.

-- ── 9. Admin audit log ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_actions (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT,
  details     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions(created_at DESC);
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;  -- no policies: service role only

-- ── 10. Payouts: reserve-on-request model ──────────────────────────────────
-- Old flow: vendors inserted payout_requests from the browser (and, because the
-- policy was FOR ALL, could also mark them 'paid'); balance was never reserved.
DROP POLICY IF EXISTS "payouts_vendor" ON payout_requests;
DROP POLICY IF EXISTS "payouts_vendor_read" ON payout_requests;
CREATE POLICY "payouts_vendor_read" ON payout_requests FOR SELECT USING (auth.uid() = vendor_id);

CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_bank_date ON purchases(bank_id, purchased_at DESC);

-- ONE-TIME: reserve funds for requests that were opened under the old flow.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_payout') THEN
    UPDATE profiles p SET pending_payout = GREATEST(0, p.pending_payout - r.total)
    FROM (SELECT vendor_id, SUM(amount) AS total FROM payout_requests
          WHERE status IN ('pending','processing') GROUP BY vendor_id) r
    WHERE p.id = r.vendor_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION request_payout(
  p_vendor UUID, p_amount NUMERIC, p_bank TEXT, p_account TEXT, p_name TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v profiles%ROWTYPE; v_id UUID;
BEGIN
  SELECT * INTO v FROM profiles WHERE id = p_vendor FOR UPDATE;
  IF NOT FOUND OR v.role <> 'vendor'              THEN RAISE EXCEPTION 'not_vendor'; END IF;
  IF v.vendor_status <> 'active'                  THEN RAISE EXCEPTION 'vendor_suspended'; END IF;
  IF v.vendor_terms_accepted_at IS NULL           THEN RAISE EXCEPTION 'terms_not_accepted'; END IF;
  IF p_amount < 100000                            THEN RAISE EXCEPTION 'below_minimum'; END IF;      -- ₦1,000 in kobo
  IF p_amount > v.pending_payout                  THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  IF EXISTS (SELECT 1 FROM payout_requests
             WHERE vendor_id = p_vendor AND status IN ('pending','processing'))
                                                  THEN RAISE EXCEPTION 'open_request_exists'; END IF;

  UPDATE profiles SET pending_payout = pending_payout - p_amount WHERE id = p_vendor;  -- reserve
  INSERT INTO payout_requests (vendor_id, amount, bank_name, account_number, account_name, status)
  VALUES (p_vendor, p_amount, p_bank, p_account, p_name, 'pending')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION process_payout(p_id UUID, p_status TEXT, p_note TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r payout_requests%ROWTYPE;
BEGIN
  IF p_status NOT IN ('processing','paid','rejected') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  SELECT * INTO r FROM payout_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF r.status IN ('paid','rejected') THEN RAISE EXCEPTION 'already_final'; END IF;
  IF p_status = 'processing' AND r.status <> 'pending' THEN RAISE EXCEPTION 'invalid_transition'; END IF;

  IF p_status = 'paid' THEN
    UPDATE profiles SET total_paid_out = total_paid_out + r.amount WHERE id = r.vendor_id;
  ELSIF p_status = 'rejected' THEN
    UPDATE profiles SET pending_payout = pending_payout + r.amount WHERE id = r.vendor_id;  -- release reserve
  END IF;

  UPDATE payout_requests SET
    status = p_status,
    admin_note = COALESCE(NULLIF(p_note, ''), admin_note),
    processed_at = CASE WHEN p_status IN ('paid','rejected') THEN NOW() ELSE processed_at END
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION request_payout(UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION process_payout(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION request_payout(UUID, NUMERIC, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION process_payout(UUID, TEXT, TEXT) TO service_role;

COMMIT;

-- ── Make yourself the first admin (run manually, once, in the SQL editor) ──
-- UPDATE profiles SET role = 'admin' WHERE email = 'you@example.com';
