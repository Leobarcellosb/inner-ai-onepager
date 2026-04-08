-- Allow admins to delete any reference (not just uploader)
DROP POLICY IF EXISTS "v2_references_delete" ON public.references;
CREATE POLICY "v2_references_delete" ON public.references
  FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );
