
-- =====================================================
-- 1. ADD created_by TO TABLES THAT LACK IT
-- =====================================================

-- briefs: add created_by (nullable for existing rows)
ALTER TABLE public.briefs ADD COLUMN IF NOT EXISTS created_by uuid;

-- reference_analyses: add created_by (nullable for existing rows)
ALTER TABLE public.reference_analyses ADD COLUMN IF NOT EXISTS created_by uuid;

-- references: add created_by (nullable for existing rows, will migrate from uploaded_by)
ALTER TABLE public."references" ADD COLUMN IF NOT EXISTS created_by uuid;

-- Migrate uploaded_by -> created_by for references
UPDATE public."references" SET created_by = uploaded_by WHERE created_by IS NULL AND uploaded_by IS NOT NULL;

-- =====================================================
-- 2. DROP ALL OLD POLICIES ON ALL BUSINESS TABLES
-- =====================================================

-- contents
DROP POLICY IF EXISTS "Admins can do anything with contents" ON public.contents;
DROP POLICY IF EXISTS "Social media can view all contents" ON public.contents;
DROP POLICY IF EXISTS "Social media can create contents" ON public.contents;
DROP POLICY IF EXISTS "Social media can update contents" ON public.contents;
DROP POLICY IF EXISTS "Designers can view contents" ON public.contents;
DROP POLICY IF EXISTS "authenticated users can read contents" ON public.contents;
DROP POLICY IF EXISTS "authenticated users can insert own contents" ON public.contents;
DROP POLICY IF EXISTS "users can update own contents" ON public.contents;

-- briefs
DROP POLICY IF EXISTS "Admins can do anything with briefs" ON public.briefs;
DROP POLICY IF EXISTS "Social media can view briefs" ON public.briefs;
DROP POLICY IF EXISTS "Social media can create briefs" ON public.briefs;
DROP POLICY IF EXISTS "Social media can update briefs" ON public.briefs;
DROP POLICY IF EXISTS "Designers can view briefs" ON public.briefs;
DROP POLICY IF EXISTS "Designers can update brief notes and status" ON public.briefs;

-- editorial_guidelines
DROP POLICY IF EXISTS "Admins can do anything with editorial" ON public.editorial_guidelines;
DROP POLICY IF EXISTS "Social media can view editorial" ON public.editorial_guidelines;
DROP POLICY IF EXISTS "Social media can create editorial" ON public.editorial_guidelines;
DROP POLICY IF EXISTS "Social media can update editorial" ON public.editorial_guidelines;
DROP POLICY IF EXISTS "Designers can view editorial" ON public.editorial_guidelines;
DROP POLICY IF EXISTS "auth read editorial_guidelines" ON public.editorial_guidelines;
DROP POLICY IF EXISTS "auth insert editorial_guidelines" ON public.editorial_guidelines;
DROP POLICY IF EXISTS "auth update editorial_guidelines" ON public.editorial_guidelines;
DROP POLICY IF EXISTS "auth delete editorial_guidelines" ON public.editorial_guidelines;

-- references
DROP POLICY IF EXISTS "Admins can do anything with references" ON public."references";
DROP POLICY IF EXISTS "Social media can view references" ON public."references";
DROP POLICY IF EXISTS "Social media can create references" ON public."references";
DROP POLICY IF EXISTS "Social media can update references" ON public."references";
DROP POLICY IF EXISTS "Designers can view references" ON public."references";
DROP POLICY IF EXISTS "auth read references" ON public."references";
DROP POLICY IF EXISTS "auth insert references" ON public."references";
DROP POLICY IF EXISTS "auth update references" ON public."references";
DROP POLICY IF EXISTS "auth delete references" ON public."references";

-- reference_analyses
DROP POLICY IF EXISTS "Admins can do anything with analyses" ON public.reference_analyses;
DROP POLICY IF EXISTS "Social media can view analyses" ON public.reference_analyses;
DROP POLICY IF EXISTS "Social media can create analyses" ON public.reference_analyses;
DROP POLICY IF EXISTS "Social media can update analyses" ON public.reference_analyses;
DROP POLICY IF EXISTS "Designers can view analyses" ON public.reference_analyses;
DROP POLICY IF EXISTS "auth read reference_analyses" ON public.reference_analyses;
DROP POLICY IF EXISTS "auth upsert reference_analyses" ON public.reference_analyses;
DROP POLICY IF EXISTS "auth update reference_analyses" ON public.reference_analyses;

-- playbooks
DROP POLICY IF EXISTS "Admins can do anything with playbooks" ON public.playbooks;
DROP POLICY IF EXISTS "Social media can view playbooks" ON public.playbooks;
DROP POLICY IF EXISTS "Social media can create playbooks" ON public.playbooks;
DROP POLICY IF EXISTS "Social media can update playbooks" ON public.playbooks;
DROP POLICY IF EXISTS "Designers can view playbooks" ON public.playbooks;
DROP POLICY IF EXISTS "auth read playbooks" ON public.playbooks;
DROP POLICY IF EXISTS "auth insert playbooks" ON public.playbooks;
DROP POLICY IF EXISTS "auth update playbooks" ON public.playbooks;
DROP POLICY IF EXISTS "auth delete playbooks" ON public.playbooks;

-- =====================================================
-- 3. CREATE NEW STANDARDIZED POLICIES
-- =====================================================

-- CONTENTS
CREATE POLICY "v2_contents_select" ON public.contents FOR SELECT TO authenticated USING (true);
CREATE POLICY "v2_contents_insert" ON public.contents FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "v2_contents_update" ON public.contents FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "v2_contents_delete" ON public.contents FOR DELETE TO authenticated USING (created_by = auth.uid());

-- BRIEFS
CREATE POLICY "v2_briefs_select" ON public.briefs FOR SELECT TO authenticated USING (true);
CREATE POLICY "v2_briefs_insert" ON public.briefs FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "v2_briefs_update" ON public.briefs FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "v2_briefs_delete" ON public.briefs FOR DELETE TO authenticated USING (created_by = auth.uid());

-- EDITORIAL_GUIDELINES
CREATE POLICY "v2_editorial_select" ON public.editorial_guidelines FOR SELECT TO authenticated USING (true);
CREATE POLICY "v2_editorial_insert" ON public.editorial_guidelines FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "v2_editorial_update" ON public.editorial_guidelines FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "v2_editorial_delete" ON public.editorial_guidelines FOR DELETE TO authenticated USING (created_by = auth.uid());

-- REFERENCES
CREATE POLICY "v2_references_select" ON public."references" FOR SELECT TO authenticated USING (true);
CREATE POLICY "v2_references_insert" ON public."references" FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "v2_references_update" ON public."references" FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "v2_references_delete" ON public."references" FOR DELETE TO authenticated USING (created_by = auth.uid());

-- REFERENCE_ANALYSES (insert/update open for authenticated - edge function uses service role)
CREATE POLICY "v2_ref_analyses_select" ON public.reference_analyses FOR SELECT TO authenticated USING (true);
CREATE POLICY "v2_ref_analyses_insert" ON public.reference_analyses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v2_ref_analyses_update" ON public.reference_analyses FOR UPDATE TO authenticated USING (true);

-- PLAYBOOKS
CREATE POLICY "v2_playbooks_select" ON public.playbooks FOR SELECT TO authenticated USING (true);
CREATE POLICY "v2_playbooks_insert" ON public.playbooks FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "v2_playbooks_update" ON public.playbooks FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "v2_playbooks_delete" ON public.playbooks FOR DELETE TO authenticated USING (created_by = auth.uid());
