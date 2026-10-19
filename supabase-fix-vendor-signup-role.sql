-- PastQ fix: vendors not landing on their dashboard after signup / sign-in
-- Run once in the Supabase SQL editor (safe to re-run).
--
-- Root cause: the signup page wrote role='vendor' from the browser right after
-- signUp(). With email confirmation on (or any timing gap) there is no session
-- yet, RLS filters the UPDATE to 0 rows without an error, and the profile stays
-- 'student' -> login/redirect logic sends the user to /browse.
-- Fix: the signup trigger now reads the role from signup metadata. Only
-- 'vendor' is honoured; 'admin' can never be self-assigned.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, role, school)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    CASE WHEN NEW.raw_user_meta_data->>'role' = 'vendor' THEN 'vendor' ELSE 'student' END,
    NULLIF(NEW.raw_user_meta_data->>'school', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Backfill accounts that signed up as vendors but got stuck as students.
-- (SQL editor runs with auth.uid() IS NULL, so the profile-protection trigger allows it.)
UPDATE profiles p
SET role = 'vendor'
FROM auth.users u
WHERE u.id = p.id
  AND p.role = 'student'
  AND u.raw_user_meta_data->>'role' = 'vendor';
