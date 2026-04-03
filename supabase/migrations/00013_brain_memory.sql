-- ════════════════════════════════════════════════════════════════════════
-- Brain memory: persistent decision and performance history
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.brain_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_type TEXT NOT NULL,
  content_id UUID REFERENCES public.contents(id) ON DELETE SET NULL,
  context JSONB NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brain_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_memories_select" ON public.brain_memories FOR SELECT TO authenticated USING (true);
CREATE POLICY "v2_memories_insert" ON public.brain_memories FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_memories_type ON public.brain_memories (memory_type, created_at DESC);
CREATE INDEX idx_memories_content ON public.brain_memories (content_id) WHERE content_id IS NOT NULL;
