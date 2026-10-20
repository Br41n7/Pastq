-- PastQ: AI paper scanning (Gemini) with a monthly per-vendor cap
-- Run once in the Supabase SQL editor (safe to re-run).
--
-- Every scanned page reserves one row in vendor_scan_log BEFORE Gemini is called.
-- The reservation is atomic (advisory lock), so a vendor cannot beat the cap by
-- sending parallel requests. If Gemini fails, the server releases the reservation
-- so the vendor is not charged for a page that produced nothing.
-- The month window is the calendar month in UTC; the cap resets on the 1st.

CREATE TABLE IF NOT EXISTS vendor_scan_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_scan_log_vendor_time
  ON vendor_scan_log (vendor_id, created_at DESC);

-- Server-only table: RLS on, no policies => browser clients cannot read or write it.
ALTER TABLE vendor_scan_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION reserve_scan(p_vendor UUID, p_limit INT)
RETURNS TABLE (scan_id UUID, used INT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_start TIMESTAMPTZ := date_trunc('month', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_used  INT;
  v_id    UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('scan:' || p_vendor::text));

  SELECT COUNT(*)::INT INTO v_used
  FROM vendor_scan_log l
  WHERE l.vendor_id = p_vendor AND l.created_at >= v_start;

  IF v_used >= p_limit THEN
    RETURN QUERY SELECT NULL::UUID, v_used;   -- cap reached: no row reserved
    RETURN;
  END IF;

  INSERT INTO vendor_scan_log (vendor_id) VALUES (p_vendor) RETURNING id INTO v_id;
  RETURN QUERY SELECT v_id, v_used + 1;
END;
$$;

CREATE OR REPLACE FUNCTION release_scan(p_scan UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM vendor_scan_log WHERE id = p_scan;
$$;

REVOKE ALL ON FUNCTION reserve_scan(UUID, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION release_scan(UUID)      FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_scan(UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION release_scan(UUID)      TO service_role;
