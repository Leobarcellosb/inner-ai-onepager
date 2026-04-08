-- Allow admins to delete any content (not just their own)
DROP POLICY IF EXISTS "v2_contents_delete" ON public.contents;
CREATE POLICY "v2_contents_delete" ON public.contents
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );
