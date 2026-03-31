
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'social_media', 'designer');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Admins can view all roles
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Create content status enum
CREATE TYPE public.content_status AS ENUM ('ideia', 'rascunho', 'em_revisao', 'aguardando_design', 'em_design', 'pronto', 'publicado');
CREATE TYPE public.content_platform AS ENUM ('instagram', 'tiktok', 'youtube', 'linkedin', 'whatsapp', 'multiuso');
CREATE TYPE public.content_format AS ENUM ('reels', 'carrossel', 'story', 'post_estatico', 'anuncio', 'email', 'roteiro');
CREATE TYPE public.brief_status AS ENUM ('novo', 'em_andamento', 'em_ajuste', 'finalizado');

-- Create contents table
CREATE TABLE public.contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  theme TEXT NOT NULL DEFAULT '',
  platform content_platform NOT NULL DEFAULT 'instagram',
  format content_format NOT NULL DEFAULT 'post_estatico',
  objective TEXT NOT NULL DEFAULT '',
  target_audience TEXT NOT NULL DEFAULT '',
  funnel_stage TEXT NOT NULL DEFAULT '',
  raw_text TEXT NOT NULL DEFAULT '',
  improved_text TEXT,
  cta TEXT NOT NULL DEFAULT '',
  status content_status NOT NULL DEFAULT 'ideia',
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.contents ENABLE ROW LEVEL SECURITY;

-- RLS for contents
CREATE POLICY "Admins can do anything with contents" ON public.contents
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Social media can view all contents" ON public.contents
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'social_media'));

CREATE POLICY "Social media can create contents" ON public.contents
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'social_media') AND auth.uid() = created_by);

CREATE POLICY "Social media can update contents" ON public.contents
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'social_media'));

CREATE POLICY "Designers can view contents" ON public.contents
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'designer'));

-- Create briefs table
CREATE TABLE public.briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES public.contents(id) ON DELETE CASCADE,
  brief_title TEXT NOT NULL,
  creative_angle TEXT NOT NULL DEFAULT '',
  campaign_objective TEXT NOT NULL DEFAULT '',
  target_audience TEXT NOT NULL DEFAULT '',
  key_message TEXT NOT NULL DEFAULT '',
  visual_references TEXT NOT NULL DEFAULT '',
  visual_direction TEXT NOT NULL DEFAULT '',
  mandatory_elements TEXT NOT NULL DEFAULT '',
  suggested_slides_or_scenes TEXT NOT NULL DEFAULT '',
  copy_summary TEXT NOT NULL DEFAULT '',
  cta TEXT NOT NULL DEFAULT '',
  designer_notes TEXT NOT NULL DEFAULT '',
  status brief_status NOT NULL DEFAULT 'novo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.briefs ENABLE ROW LEVEL SECURITY;

-- RLS for briefs
CREATE POLICY "Admins can do anything with briefs" ON public.briefs
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Social media can view briefs" ON public.briefs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'social_media'));

CREATE POLICY "Social media can create briefs" ON public.briefs
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'social_media'));

CREATE POLICY "Social media can update briefs" ON public.briefs
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'social_media'));

CREATE POLICY "Designers can view briefs" ON public.briefs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'designer'));

CREATE POLICY "Designers can update brief notes and status" ON public.briefs
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'designer'));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_contents_updated_at
  BEFORE UPDATE ON public.contents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_briefs_updated_at
  BEFORE UPDATE ON public.briefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
