-- PastQ security hardening v2
-- Run AFTER supabase-schema.sql + product/access migrations.
-- Goal: vendor writes are constrained; marketplace/system fields remain server/admin controlled.

BEGIN;

-- Vendor bank mutation policy: do not give vendors a blanket FOR ALL policy.
DROP POLICY IF EXISTS "banks_vendor_all" ON question_banks;
DROP POLICY IF EXISTS "banks_vendor_insert" ON question_banks;
DROP POLICY IF EXISTS "banks_vendor_select" ON question_banks;
DROP POLICY IF EXISTS "banks_vendor_update" ON question_banks;
DROP POLICY IF EXISTS "banks_vendor_delete" ON question_banks;

CREATE POLICY "banks_vendor_insert"
ON question_banks FOR INSERT
WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "banks_vendor_select"
ON question_banks FOR SELECT
USING (auth.uid() = vendor_id OR status = 'live');

CREATE POLICY "banks_vendor_update"
ON question_banks FOR UPDATE
USING (auth.uid() = vendor_id)
WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "banks_vendor_delete"
ON question_banks FOR DELETE
USING (auth.uid() = vendor_id AND status IN ('pending','rejected'));

-- Lock system-owned bank fields from vendor UPDATEs.
CREATE OR REPLACE FUNCTION protect_question_bank_system_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND auth.uid() IS NOT NULL THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.vendor_id IS DISTINCT FROM OLD.vendor_id
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.total_sales IS DISTINCT FROM OLD.total_sales
      OR NEW.rating IS DISTINCT FROM OLD.rating
      OR NEW.rating_count IS DISTINCT FROM OLD.rating_count
      OR NEW.question_count IS DISTINCT FROM OLD.question_count
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Protected question-bank fields can only be changed by the server';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS protect_question_bank_system_fields_trigger ON question_banks;
CREATE TRIGGER protect_question_bank_system_fields_trigger
BEFORE UPDATE ON question_banks
FOR EACH ROW EXECUTE FUNCTION protect_question_bank_system_fields();

-- A live bank may be edited by its vendor, but changing its commercial/content
-- configuration sends it back to pending review rather than silently changing
-- a published listing.
CREATE OR REPLACE FUNCTION re_review_changed_live_bank()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND auth.uid() IS NOT NULL AND OLD.status = 'live' THEN
    IF NEW.title IS DISTINCT FROM OLD.title
      OR NEW.description IS DISTINCT FROM OLD.description
      OR NEW.price IS DISTINCT FROM OLD.price
      OR NEW.access_type IS DISTINCT FROM OLD.access_type
      OR NEW.preview_count IS DISTINCT FROM OLD.preview_count
      OR NEW.subject IS DISTINCT FROM OLD.subject
      OR NEW.exam_type IS DISTINCT FROM OLD.exam_type
      OR NEW.university IS DISTINCT FROM OLD.university
      OR NEW.faculty IS DISTINCT FROM OLD.faculty
      OR NEW.department IS DISTINCT FROM OLD.department
      OR NEW.programme IS DISTINCT FROM OLD.programme
      OR NEW.level IS DISTINCT FROM OLD.level
      OR NEW.semester IS DISTINCT FROM OLD.semester
      OR NEW.course_code IS DISTINCT FROM OLD.course_code
      OR NEW.course_title IS DISTINCT FROM OLD.course_title
      OR NEW.assessment_type IS DISTINCT FROM OLD.assessment_type
      OR NEW.academic_session IS DISTINCT FROM OLD.academic_session
    THEN
      NEW.status := 'pending';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS re_review_changed_live_bank_trigger ON question_banks;
CREATE TRIGGER re_review_changed_live_bank_trigger
BEFORE UPDATE ON question_banks
FOR EACH ROW EXECUTE FUNCTION re_review_changed_live_bank();

-- Prevent vendors from modifying questions belonging to another vendor/bank.
DROP POLICY IF EXISTS "questions_vendor" ON questions;
CREATE POLICY "questions_vendor_insert"
ON questions FOR INSERT
WITH CHECK (
  auth.uid() = vendor_id
  AND EXISTS (
    SELECT 1 FROM question_banks b
    WHERE b.id = bank_id AND b.vendor_id = auth.uid()
  )
);

CREATE POLICY "questions_vendor_select"
ON questions FOR SELECT
USING (auth.uid() = vendor_id);

CREATE POLICY "questions_vendor_update"
ON questions FOR UPDATE
USING (auth.uid() = vendor_id)
WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "questions_vendor_delete"
ON questions FOR DELETE
USING (auth.uid() = vendor_id);

-- Purchases: browser can read its own records only. Creation and payment-state
-- transitions are server-only via the service-role client.
DROP POLICY IF EXISTS "purchases_own" ON purchases;
DROP POLICY IF EXISTS "purchases_read_own" ON purchases;
CREATE POLICY "purchases_read_own"
ON purchases FOR SELECT
USING (auth.uid() = user_id);

-- Paystack references must be unique (already true in base schema); add a
-- helpful lookup index for verification.
CREATE INDEX IF NOT EXISTS idx_purchases_reference_status
ON purchases(paystack_reference, paystack_status);

COMMIT;
