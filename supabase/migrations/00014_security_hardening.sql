-- ════════════════════════════════════════════════════════════════════════
-- Security hardening: tighten RLS policies + add constraints
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. CONTENTS: restrict UPDATE to owner or assigned ────────────────

DROP POLICY IF EXISTS "v2_contents_update" ON public.contents;
CREATE POLICY "v2_contents_update" ON public.contents
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ── 2. BRIEFS: restrict INSERT/UPDATE to content owner ──────────────

DROP POLICY IF EXISTS "v2_briefs_insert" ON public.briefs;
CREATE POLICY "v2_briefs_insert" ON public.briefs
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "v2_briefs_update" ON public.briefs;
CREATE POLICY "v2_briefs_update" ON public.briefs
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ── 3. REFERENCE_ANALYSES: restrict writes ──────────────────────────

DROP POLICY IF EXISTS "v2_ref_analyses_insert" ON public.reference_analyses;
CREATE POLICY "v2_ref_analyses_insert" ON public.reference_analyses
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

DROP POLICY IF EXISTS "v2_ref_analyses_update" ON public.reference_analyses;
CREATE POLICY "v2_ref_analyses_update" ON public.reference_analyses
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR created_by IS NULL OR public.has_role(auth.uid(), 'admin'));

-- ── 4. BRAIN_MEMORIES: restrict insert to authenticated ─────────────

DROP POLICY IF EXISTS "v2_memories_insert" ON public.brain_memories;
CREATE POLICY "v2_memories_insert" ON public.brain_memories
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- ── 5. KNOWLEDGE_ENTRIES: restrict writes ───────────────────────────

DROP POLICY IF EXISTS "v2_knowledge_update" ON public.knowledge_entries;
CREATE POLICY "v2_knowledge_update" ON public.knowledge_entries
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Note: SELECT USING(true) is intentionally kept for shared resources
-- (contents, briefs, references, playbooks, company_config, knowledge)
-- because this is a team collaboration tool where all members need
-- read access. Write restrictions above prevent unauthorized modifications.
