-- Add simpler auth-based policies for contents (V1)

-- Authenticated users can read all contents
CREATE POLICY "authenticated users can read contents"
ON public.contents
FOR SELECT
TO authenticated
USING (true);

-- Authenticated users can insert own contents
CREATE POLICY "authenticated users can insert own contents"
ON public.contents
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Users can update own contents
CREATE POLICY "users can update own contents"
ON public.contents
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());