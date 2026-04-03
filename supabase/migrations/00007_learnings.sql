-- ════════════════════════════════════════════════════════════════════════
-- Add learnings_json to company_config for accumulated reference patterns
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.company_config
  ADD COLUMN IF NOT EXISTS learnings_json JSONB NOT NULL DEFAULT '{"hooks":[],"copy_patterns":[],"visual_patterns":[],"structures":[],"ctas":[]}';
