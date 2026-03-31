
-- Simplified auth-based policies for Intelligence tab (V1)

-- === editorial_guidelines ===
CREATE POLICY "auth read editorial_guidelines"
ON public.editorial_guidelines FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth insert editorial_guidelines"
ON public.editorial_guidelines FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "auth update editorial_guidelines"
ON public.editorial_guidelines FOR UPDATE TO authenticated
USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE POLICY "auth delete editorial_guidelines"
ON public.editorial_guidelines FOR DELETE TO authenticated
USING (created_by = auth.uid());

-- === references ===
CREATE POLICY "auth read references"
ON public."references" FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth insert references"
ON public."references" FOR INSERT TO authenticated
WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "auth update references"
ON public."references" FOR UPDATE TO authenticated
USING (uploaded_by = auth.uid()) WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "auth delete references"
ON public."references" FOR DELETE TO authenticated
USING (uploaded_by = auth.uid());

-- === reference_analyses ===
CREATE POLICY "auth read reference_analyses"
ON public.reference_analyses FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth upsert reference_analyses"
ON public.reference_analyses FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "auth update reference_analyses"
ON public.reference_analyses FOR UPDATE TO authenticated
USING (true);

-- === playbooks ===
CREATE POLICY "auth read playbooks"
ON public.playbooks FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth insert playbooks"
ON public.playbooks FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "auth update playbooks"
ON public.playbooks FOR UPDATE TO authenticated
USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE POLICY "auth delete playbooks"
ON public.playbooks FOR DELETE TO authenticated
USING (created_by = auth.uid());
