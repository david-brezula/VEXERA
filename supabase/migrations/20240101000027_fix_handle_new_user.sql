-- Fix handle_new_user: add SET search_path = '' and use fully-qualified table name.
-- Without SET search_path, a SECURITY DEFINER function runs in the caller's search_path,
-- which in the auth trigger context may not include 'public', causing the INSERT to fail
-- with "relation profiles does not exist" and surfacing as a 500 on /auth/v1/signup.
-- Using SET search_path = '' forces full qualification and is Supabase's recommended pattern.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- Re-bind the trigger to pick up the updated function definition.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
