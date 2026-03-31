
-- Drop existing overly permissive storage policies
DROP POLICY IF EXISTS "Authenticated users can upload reference images" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can delete own reference images" ON storage.objects;

-- Restrict uploads to social_media and admin roles
CREATE POLICY "Social media and admins can upload reference images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'reference-images'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'social_media'::public.app_role)
  )
);

-- Restrict deletes to admins only (safest approach since owner tracking is in references table)
CREATE POLICY "Admins can delete reference images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'reference-images'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);
