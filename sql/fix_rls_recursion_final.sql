-- Final fix for RLS infinite recursion issue
-- This script fixes the infinite recursion in RLS policies by using security definer functions

-- Drop all existing policies first
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super Admins can manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super Admins can manage all profiles" ON public.profiles;

-- Create a security definer function to check user role level without recursion
CREATE OR REPLACE FUNCTION public.get_current_user_role_level()
RETURNS integer AS $$
DECLARE
  user_role_level integer := 1; -- Default to user level
  current_user_id uuid;
BEGIN
  -- Get current authenticated user ID
  current_user_id := auth.uid();
  
  -- If no authenticated user, return default level
  IF current_user_id IS NULL THEN
    RETURN 1;
  END IF;
  
  -- Query role level directly without RLS interference
  SELECT COALESCE(r.level, 1) INTO user_role_level
  FROM public.profiles p
  LEFT JOIN public.roles r ON p.role_id = r.id
  WHERE p.id = current_user_id
  LIMIT 1;
  
  -- Return found level or default
  RETURN COALESCE(user_role_level, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create simple policies without self-referencing

-- Users can view and manage their own profile
CREATE POLICY "Users can manage own profile" ON public.profiles
  FOR ALL 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can view all profiles (level 2+)
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT 
  USING (public.get_current_user_role_level() >= 2);

-- Super Admins can manage all profiles (level 3+)
CREATE POLICY "Super Admins can manage all profiles" ON public.profiles
  FOR ALL 
  USING (public.get_current_user_role_level() >= 3)
  WITH CHECK (public.get_current_user_role_level() >= 3);

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_current_user_role_level() TO authenticated;

-- Clean up any duplicate profiles
DELETE FROM public.profiles 
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY id ORDER BY created_at DESC) as rn
    FROM public.profiles
  ) t WHERE t.rn > 1
);