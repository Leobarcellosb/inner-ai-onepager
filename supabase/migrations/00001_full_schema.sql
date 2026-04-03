-- ════════════════════════════════════════════════════════════════════════
-- Inner AI — Full Schema (clean install)
-- Supabase SQL Editor — cole tudo e clique Run
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. EXTENSIONS ───────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 2. ENUMS ────────────────────────────────────────────────────────────

CREATE TYPE public.app_role AS ENUM ('admin', 'social_media', 'designer');
CREATE TYPE public.content_status AS ENUM ('ideia', 'rascunho', 'em_revisao', 'aguardando_design', 'em_design', 'pronto', 'publicado');
CREATE TYPE public.content_platform AS ENUM ('instagram', 'tiktok', 'youtube', 'linkedin', 'whatsapp', 'multiuso');
CREATE TYPE public.content_format AS ENUM ('reels', 'carrossel', 'story', 'post_estatico', 'anuncio', 'email', 'roteiro');
CREATE TYPE public.brief_status AS ENUM ('novo', 'em_andamento', 'em_ajuste', 'finalizado');
CREATE TYPE public.analysis_status AS ENUM ('pendente', 'em_analise', 'analisado', 'erro');

-- ── 3. TABLES ───────────────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_date DATE,
  scheduled_time TIME,
  scheduled_datetime TIMESTAMPTZ,
  posting_timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  figma_link TEXT,
  parent_content_id UUID REFERENCES public.contents(id) ON DELETE SET NULL
);

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
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.editorial_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_positioning TEXT NOT NULL DEFAULT '',
  brand_voice TEXT NOT NULL DEFAULT '',
  communication_pillars TEXT NOT NULL DEFAULT '',
  content_pillars TEXT NOT NULL DEFAULT '',
  audience_profiles TEXT NOT NULL DEFAULT '',
  forbidden_terms TEXT NOT NULL DEFAULT '',
  preferred_terms TEXT NOT NULL DEFAULT '',
  visual_identity_guidelines TEXT NOT NULL DEFAULT '',
  cta_patterns TEXT NOT NULL DEFAULT '',
  creative_principles TEXT NOT NULL DEFAULT '',
  examples_of_good_content TEXT NOT NULL DEFAULT '',
  examples_of_bad_content TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source_name TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT 'instagram',
  reference_image_url TEXT,
  caption_or_observed_copy TEXT NOT NULL DEFAULT '',
  observed_hook TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'post_estatico',
  objective_guess TEXT NOT NULL DEFAULT '',
  audience_guess TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  analysis_status analysis_status NOT NULL DEFAULT 'pendente',
  uploaded_by UUID NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.reference_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id UUID NOT NULL REFERENCES public.references(id) ON DELETE CASCADE,
  analysis_summary TEXT NOT NULL DEFAULT '',
  piece_type TEXT NOT NULL DEFAULT '',
  probable_objective TEXT NOT NULL DEFAULT '',
  probable_audience TEXT NOT NULL DEFAULT '',
  main_hook TEXT NOT NULL DEFAULT '',
  copy_structure TEXT NOT NULL DEFAULT '',
  central_promise TEXT NOT NULL DEFAULT '',
  persuasion_mechanisms TEXT NOT NULL DEFAULT '',
  emotional_angle TEXT NOT NULL DEFAULT '',
  rational_angle TEXT NOT NULL DEFAULT '',
  visual_hierarchy TEXT NOT NULL DEFAULT '',
  observed_color_pattern TEXT NOT NULL DEFAULT '',
  observed_typography_style TEXT NOT NULL DEFAULT '',
  visual_composition TEXT NOT NULL DEFAULT '',
  highlight_elements TEXT NOT NULL DEFAULT '',
  observed_cta TEXT NOT NULL DEFAULT '',
  why_it_works TEXT NOT NULL DEFAULT '',
  strengths TEXT NOT NULL DEFAULT '',
  weaknesses TEXT NOT NULL DEFAULT '',
  fatigue_risks TEXT NOT NULL DEFAULT '',
  adaptation_for_inner_ai TEXT NOT NULL DEFAULT '',
  inspired_generation_prompt TEXT NOT NULL DEFAULT '',
  inspired_copy_prompt TEXT NOT NULL DEFAULT '',
  execution_checklist TEXT NOT NULL DEFAULT '',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reference_id)
);

CREATE TABLE public.playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  framework TEXT NOT NULL DEFAULT '',
  examples TEXT NOT NULL DEFAULT '',
  recommended_use_cases TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID REFERENCES public.contents(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 4. INDEXES ──────────────────────────────────────────────────────────

CREATE INDEX idx_notifications_user_unread
  ON public.notifications (user_id, read, created_at DESC);

CREATE INDEX idx_contents_parent
  ON public.contents (parent_content_id)
  WHERE parent_content_id IS NOT NULL;

-- ── 5. FUNCTIONS (depend on tables) ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.sync_scheduled_datetime()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.scheduled_date IS NOT NULL AND NEW.scheduled_time IS NOT NULL THEN
    NEW.scheduled_datetime := (NEW.scheduled_date || 'T' || NEW.scheduled_time)::timestamp
      AT TIME ZONE COALESCE(NEW.posting_timezone, 'America/Sao_Paulo');
  ELSE
    NEW.scheduled_datetime := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_schedule_for_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.scheduled_date IS NOT NULL AND NEW.scheduled_time IS NULL THEN
    RAISE EXCEPTION 'Preencha também o horário da postagem.';
  END IF;
  IF NEW.scheduled_time IS NOT NULL AND NEW.scheduled_date IS NULL THEN
    RAISE EXCEPTION 'Preencha também a data da postagem.';
  END IF;
  IF NEW.status IN ('pronto', 'publicado') THEN
    IF NEW.scheduled_date IS NULL THEN
      RAISE EXCEPTION 'Defina a data da postagem antes de concluir este conteúdo.';
    END IF;
    IF NEW.scheduled_time IS NULL THEN
      RAISE EXCEPTION 'Defina o horário da postagem antes de concluir este conteúdo.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 6. ROW LEVEL SECURITY + POLICIES ────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editorial_guidelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Social media can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'social_media'));
CREATE POLICY "Designers can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'designer'));
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can update roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- contents
CREATE POLICY "v2_contents_select" ON public.contents FOR SELECT TO authenticated USING (true);
CREATE POLICY "v2_contents_insert" ON public.contents FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "v2_contents_update" ON public.contents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "v2_contents_delete" ON public.contents FOR DELETE TO authenticated USING (created_by = auth.uid());

-- briefs
CREATE POLICY "v2_briefs_select" ON public.briefs FOR SELECT TO authenticated USING (true);
CREATE POLICY "v2_briefs_insert" ON public.briefs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v2_briefs_update" ON public.briefs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "v2_briefs_delete" ON public.briefs FOR DELETE TO authenticated USING (created_by = auth.uid());

-- editorial_guidelines
CREATE POLICY "v2_editorial_select" ON public.editorial_guidelines FOR SELECT TO authenticated USING (true);
CREATE POLICY "v2_editorial_insert" ON public.editorial_guidelines FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "v2_editorial_update" ON public.editorial_guidelines FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "v2_editorial_delete" ON public.editorial_guidelines FOR DELETE TO authenticated USING (created_by = auth.uid());

-- references
CREATE POLICY "v2_references_select" ON public.references FOR SELECT TO authenticated USING (true);
CREATE POLICY "v2_references_insert" ON public.references FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "v2_references_update" ON public.references FOR UPDATE TO authenticated USING (uploaded_by = auth.uid());
CREATE POLICY "v2_references_delete" ON public.references FOR DELETE TO authenticated USING (uploaded_by = auth.uid());

-- reference_analyses (open insert/update — edge function uses service role)
CREATE POLICY "v2_ref_analyses_select" ON public.reference_analyses FOR SELECT TO authenticated USING (true);
CREATE POLICY "v2_ref_analyses_insert" ON public.reference_analyses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v2_ref_analyses_update" ON public.reference_analyses FOR UPDATE TO authenticated USING (true);

-- playbooks
CREATE POLICY "v2_playbooks_select" ON public.playbooks FOR SELECT TO authenticated USING (true);
CREATE POLICY "v2_playbooks_insert" ON public.playbooks FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "v2_playbooks_update" ON public.playbooks FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "v2_playbooks_delete" ON public.playbooks FOR DELETE TO authenticated USING (created_by = auth.uid());

-- notifications
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── 7. TRIGGERS ─────────────────────────────────────────────────────────

CREATE TRIGGER update_contents_updated_at BEFORE UPDATE ON public.contents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_briefs_updated_at BEFORE UPDATE ON public.briefs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_editorial_guidelines_updated_at BEFORE UPDATE ON public.editorial_guidelines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_references_updated_at BEFORE UPDATE ON public.references FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reference_analyses_updated_at BEFORE UPDATE ON public.reference_analyses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_playbooks_updated_at BEFORE UPDATE ON public.playbooks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER sync_scheduled_datetime_trigger
  BEFORE INSERT OR UPDATE ON public.contents
  FOR EACH ROW EXECUTE FUNCTION public.sync_scheduled_datetime();

CREATE TRIGGER validate_schedule_trigger
  BEFORE INSERT OR UPDATE ON public.contents
  FOR EACH ROW EXECUTE FUNCTION public.validate_schedule_for_status();

-- ── 8. STORAGE ──────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('reference-images', 'reference-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Social media and admins can upload reference images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'reference-images'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'social_media'))
  );

CREATE POLICY "Anyone can view reference images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'reference-images');

CREATE POLICY "Admins can delete reference images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'reference-images' AND public.has_role(auth.uid(), 'admin'));
