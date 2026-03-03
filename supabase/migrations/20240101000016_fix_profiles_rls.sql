-- Allow users to insert their own profile row.
-- This handles cases where the handle_new_user trigger didn't fire
-- (e.g. users created before the trigger was deployed).
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
