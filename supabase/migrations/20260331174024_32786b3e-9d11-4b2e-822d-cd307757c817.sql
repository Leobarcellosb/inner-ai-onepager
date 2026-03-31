
-- Storage bucket for reference images
INSERT INTO storage.buckets (id, name, public) VALUES ('reference-images', 'reference-images', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload reference images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'reference-images');

CREATE POLICY "Anyone can view reference images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'reference-images');

CREATE POLICY "Uploaders can delete own reference images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'reference-images');

-- Editorial Guidelines table
CREATE TABLE public.editorial_guidelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_positioning text NOT NULL DEFAULT '',
  brand_voice text NOT NULL DEFAULT '',
  communication_pillars text NOT NULL DEFAULT '',
  content_pillars text NOT NULL DEFAULT '',
  audience_profiles text NOT NULL DEFAULT '',
  forbidden_terms text NOT NULL DEFAULT '',
  preferred_terms text NOT NULL DEFAULT '',
  visual_identity_guidelines text NOT NULL DEFAULT '',
  cta_patterns text NOT NULL DEFAULT '',
  creative_principles text NOT NULL DEFAULT '',
  examples_of_good_content text NOT NULL DEFAULT '',
  examples_of_bad_content text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.editorial_guidelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do anything with editorial" ON public.editorial_guidelines FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Social media can view editorial" ON public.editorial_guidelines FOR SELECT TO authenticated USING (has_role(auth.uid(), 'social_media'));
CREATE POLICY "Social media can create editorial" ON public.editorial_guidelines FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'social_media'));
CREATE POLICY "Social media can update editorial" ON public.editorial_guidelines FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'social_media'));
CREATE POLICY "Designers can view editorial" ON public.editorial_guidelines FOR SELECT TO authenticated USING (has_role(auth.uid(), 'designer'));

-- References table
CREATE TYPE public.analysis_status AS ENUM ('pendente', 'em_analise', 'analisado');

CREATE TABLE public.references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  source_name text NOT NULL DEFAULT '',
  source_type text NOT NULL DEFAULT '',
  platform text NOT NULL DEFAULT 'instagram',
  reference_image_url text,
  caption_or_observed_copy text NOT NULL DEFAULT '',
  observed_hook text NOT NULL DEFAULT '',
  format text NOT NULL DEFAULT 'post_estatico',
  objective_guess text NOT NULL DEFAULT '',
  audience_guess text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  analysis_status analysis_status NOT NULL DEFAULT 'pendente',
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do anything with references" ON public.references FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Social media can view references" ON public.references FOR SELECT TO authenticated USING (has_role(auth.uid(), 'social_media'));
CREATE POLICY "Social media can create references" ON public.references FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'social_media'));
CREATE POLICY "Social media can update references" ON public.references FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'social_media'));
CREATE POLICY "Designers can view references" ON public.references FOR SELECT TO authenticated USING (has_role(auth.uid(), 'designer'));

-- Reference Analyses table
CREATE TABLE public.reference_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id uuid NOT NULL REFERENCES public.references(id) ON DELETE CASCADE,
  analysis_summary text NOT NULL DEFAULT '',
  piece_type text NOT NULL DEFAULT '',
  probable_objective text NOT NULL DEFAULT '',
  probable_audience text NOT NULL DEFAULT '',
  main_hook text NOT NULL DEFAULT '',
  copy_structure text NOT NULL DEFAULT '',
  central_promise text NOT NULL DEFAULT '',
  persuasion_mechanisms text NOT NULL DEFAULT '',
  emotional_angle text NOT NULL DEFAULT '',
  rational_angle text NOT NULL DEFAULT '',
  visual_hierarchy text NOT NULL DEFAULT '',
  observed_color_pattern text NOT NULL DEFAULT '',
  observed_typography_style text NOT NULL DEFAULT '',
  visual_composition text NOT NULL DEFAULT '',
  highlight_elements text NOT NULL DEFAULT '',
  observed_cta text NOT NULL DEFAULT '',
  why_it_works text NOT NULL DEFAULT '',
  strengths text NOT NULL DEFAULT '',
  weaknesses text NOT NULL DEFAULT '',
  fatigue_risks text NOT NULL DEFAULT '',
  adaptation_for_inner_ai text NOT NULL DEFAULT '',
  inspired_generation_prompt text NOT NULL DEFAULT '',
  inspired_copy_prompt text NOT NULL DEFAULT '',
  execution_checklist text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reference_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do anything with analyses" ON public.reference_analyses FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Social media can view analyses" ON public.reference_analyses FOR SELECT TO authenticated USING (has_role(auth.uid(), 'social_media'));
CREATE POLICY "Social media can create analyses" ON public.reference_analyses FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'social_media'));
CREATE POLICY "Social media can update analyses" ON public.reference_analyses FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'social_media'));
CREATE POLICY "Designers can view analyses" ON public.reference_analyses FOR SELECT TO authenticated USING (has_role(auth.uid(), 'designer'));

-- Playbooks table
CREATE TABLE public.playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  framework text NOT NULL DEFAULT '',
  examples text NOT NULL DEFAULT '',
  recommended_use_cases text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do anything with playbooks" ON public.playbooks FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Social media can view playbooks" ON public.playbooks FOR SELECT TO authenticated USING (has_role(auth.uid(), 'social_media'));
CREATE POLICY "Social media can create playbooks" ON public.playbooks FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'social_media'));
CREATE POLICY "Social media can update playbooks" ON public.playbooks FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'social_media'));
CREATE POLICY "Designers can view playbooks" ON public.playbooks FOR SELECT TO authenticated USING (has_role(auth.uid(), 'designer'));

-- Updated_at triggers
CREATE TRIGGER update_editorial_guidelines_updated_at BEFORE UPDATE ON public.editorial_guidelines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_references_updated_at BEFORE UPDATE ON public.references FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reference_analyses_updated_at BEFORE UPDATE ON public.reference_analyses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_playbooks_updated_at BEFORE UPDATE ON public.playbooks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
