-- ════════════════════════════════════════════════════════════════════════
-- Company config: centraliza ICP, editorial, tom de voz e regras
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.company_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES auth.users(id),
  icp_json JSONB NOT NULL DEFAULT '{}',
  editorial_guidelines_json JSONB NOT NULL DEFAULT '{}',
  voice_tone_json JSONB NOT NULL DEFAULT '{}',
  rules_json JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.company_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_company_config_select" ON public.company_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "v2_company_config_insert" ON public.company_config
  FOR INSERT TO authenticated WITH CHECK (company_id = auth.uid());
CREATE POLICY "v2_company_config_update" ON public.company_config
  FOR UPDATE TO authenticated USING (company_id = auth.uid());

CREATE TRIGGER update_company_config_updated_at
  BEFORE UPDATE ON public.company_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
