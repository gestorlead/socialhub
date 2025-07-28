-- Final RLS fix with simplified policies for client compatibility

-- Drop all existing policies
DROP POLICY IF EXISTS "users_select_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "users_insert_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "admins_select_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "superadmins_manage_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "enable_read_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "enable_insert_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "enable_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "enable_delete_own_profile" ON public.profiles;

-- Create simple, client-compatible policies
-- Users can see their own profile
CREATE POLICY "enable_read_own_profile" ON public.profiles
  FOR SELECT 
  USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "enable_insert_own_profile" ON public.profiles
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "enable_update_own_profile" ON public.profiles
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can delete their own profile
CREATE POLICY "enable_delete_own_profile" ON public.profiles
  FOR DELETE 
  USING (auth.uid() = id);

-- Ensure the role level function exists and works
CREATE OR REPLACE FUNCTION public.get_current_user_role_level()
RETURNS integer AS $$
DECLARE
  user_role_level integer := 1;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN 1;
  END IF;
  
  SELECT COALESCE(r.level, 1) INTO user_role_level
  FROM public.profiles p
  LEFT JOIN public.roles r ON p.role_id = r.id
  WHERE p.id = current_user_id
  LIMIT 1;
  
  RETURN COALESCE(user_role_level, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_current_user_role_level() TO authenticated, anon;

-- Create admin view for admin access
DROP VIEW IF EXISTS public.admin_profiles_view;
CREATE VIEW public.admin_profiles_view AS
SELECT 
  p.*,
  r.name as role_name,
  r.level as role_level
FROM public.profiles p
LEFT JOIN public.roles r ON p.role_id = r.id
WHERE public.get_current_user_role_level() >= 2;

GRANT SELECT ON public.admin_profiles_view TO authenticated;

-- Ensure trigger is working
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id, 
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.email
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();