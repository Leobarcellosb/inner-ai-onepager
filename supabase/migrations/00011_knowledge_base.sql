-- ════════════════════════════════════════════════════════════════════════
-- Knowledge base: uploaded documents that feed the brand brain
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'text',
  content_text TEXT NOT NULL DEFAULT '',
  extracted_insights JSONB NOT NULL DEFAULT '[]',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_knowledge_select" ON public.knowledge_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "v2_knowledge_insert" ON public.knowledge_entries FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "v2_knowledge_update" ON public.knowledge_entries FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "v2_knowledge_delete" ON public.knowledge_entries FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE TRIGGER update_knowledge_updated_at BEFORE UPDATE ON public.knowledge_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
