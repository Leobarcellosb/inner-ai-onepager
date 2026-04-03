-- ════════════════════════════════════════════════════════════════════════
-- Harden admin-only resources + add operator to storage/upload
-- ════════════════════════════════════════════════════════════════════════

-- 1. company_config: restrict write to admin only
DROP POLICY IF EXISTS "v2_company_config_insert" ON public.company_config;
CREATE POLICY "v2_company_config_insert" ON public.company_config
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "v2_company_config_update" ON public.company_config;
CREATE POLICY "v2_company_config_update" ON public.company_config
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Storage: allow operator role to upload (alongside admin and social_media)
DROP POLICY IF EXISTS "Social media and admins can upload reference images" ON storage.objects;
CREATE POLICY "Authorized users can upload reference images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'reference-images'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'operator')
      OR public.has_role(auth.uid(), 'social_media')
    )
  );

-- 3. user_roles: ensure only admin can manage (already in 00001, reinforce)
DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;
CREATE POLICY "Only admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins can update roles" ON public.user_roles;
CREATE POLICY "Only admins can update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins can delete roles" ON public.user_roles;
CREATE POLICY "Only admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
