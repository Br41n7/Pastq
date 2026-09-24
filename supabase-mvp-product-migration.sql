-- PastQ MVP PRODUCT RETOUCH / V2 MIGRATION
-- Run AFTER the hardened security migration.
-- This migration is additive: it keeps the existing marketplace data.

BEGIN;

-- University-focused metadata. Kept nullable so existing banks remain valid.
ALTER TABLE question_banks
  ADD COLUMN IF NOT EXISTS university TEXT,
  ADD COLUMN IF NOT EXISTS faculty TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS programme TEXT,
  ADD COLUMN IF NOT EXISTS level TEXT,
  ADD COLUMN IF NOT EXISTS semester TEXT,
  ADD COLUMN IF NOT EXISTS course_code TEXT,
  ADD COLUMN IF NOT EXISTS course_title TEXT,
  ADD COLUMN IF NOT EXISTS assessment_type TEXT
    CHECK (assessment_type IS NULL OR assessment_type IN ('test','exam','quiz','assignment','practice','other')),
  ADD COLUMN IF NOT EXISTS academic_session TEXT;

CREATE INDEX IF NOT EXISTS idx_question_banks_university
  ON question_banks(university);

CREATE INDEX IF NOT EXISTS idx_question_banks_course_code
  ON question_banks(course_code);

CREATE INDEX IF NOT EXISTS idx_question_banks_level
  ON question_banks(level);

CREATE INDEX IF NOT EXISTS idx_question_banks_assessment
  ON question_banks(assessment_type);

-- Content reports.
CREATE TABLE IF NOT EXISTS content_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reporter_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  bank_id UUID REFERENCES question_banks(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES questions(id) ON DELETE SET NULL,
  reason TEXT NOT NULL
    CHECK (reason IN ('wrong_answer','typo','duplicate','wrong_course','wrong_year','copyright','misleading','other')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','reviewing','resolved','dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_reports_bank
  ON content_reports(bank_id, status);

ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_own_insert" ON content_reports;
CREATE POLICY "reports_own_insert"
ON content_reports FOR INSERT
WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reports_own_select" ON content_reports;
CREATE POLICY "reports_own_select"
ON content_reports FOR SELECT
USING (auth.uid() = reporter_id);

-- Public catalog view: only safe vendor fields.
CREATE OR REPLACE VIEW public.vendor_public_profiles
WITH (security_invoker = true)
AS
SELECT
  id,
  full_name,
  school,
  avatar_url
FROM profiles
WHERE role IN ('vendor','admin');

-- Helpful catalog index for common discovery.
CREATE INDEX IF NOT EXISTS idx_question_banks_catalog
ON question_banks(status, university, department, level, course_code, assessment_type);

COMMIT;
