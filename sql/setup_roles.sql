-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create roles table
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text UNIQUE NOT NULL,
  level integer UNIQUE NOT NULL,
  description text,
  permissions jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role_id uuid REFERENCES public.roles(id) DEFAULT (SELECT id FROM public.roles WHERE name = 'User'),
  full_name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Insert default roles
INSERT INTO public.roles (name, level, description) VALUES 
  ('User', 1, 'Basic user with limited access'),
  ('Admin', 2, 'Administrator with elevated permissions'),
  ('Super Admin', 3, 'Super administrator with full access')
ON CONFLICT (name) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super Admins can manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Everyone can view roles" ON public.roles;
DROP POLICY IF EXISTS "Only Super Admins can manage roles" ON public.roles;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.level >= 2
    )
  );

CREATE POLICY "Super Admins can manage profiles" ON public.profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.level >= 3
    )
  );

-- Roles policies
CREATE POLICY "Everyone can view roles" ON public.roles
  FOR SELECT USING (true);

CREATE POLICY "Only Super Admins can manage roles" ON public.roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.level >= 3
    )
  );

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to get user role level
CREATE OR REPLACE FUNCTION public.get_user_role_level(user_id uuid)
RETURNS integer AS $$
  SELECT COALESCE(r.level, 1)
  FROM public.profiles p
  LEFT JOIN public.roles r ON p.role_id = r.id
  WHERE p.id = user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to check if user has minimum role level
CREATE OR REPLACE FUNCTION public.user_has_role_level(user_id uuid, min_level integer)
RETURNS boolean AS $$
  SELECT public.get_user_role_level(user_id) >= min_level;
$$ LANGUAGE sql SECURITY DEFINER;