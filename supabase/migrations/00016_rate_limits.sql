-- ════════════════════════════════════════════════════════════════════════
-- Rate limiting table for edge function abuse protection
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Service role only (edge functions use service role to read/write)
CREATE POLICY "service_role_only" ON public.rate_limits
  FOR ALL TO service_role USING (true);

-- Allow authenticated to insert their own (for edge functions using anon key)
CREATE POLICY "auth_insert_own" ON public.rate_limits
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_rate_limits_lookup
  ON public.rate_limits (user_id, action, created_at DESC);

-- Auto-cleanup: delete entries older than 24h (run periodically or via cron)
-- For now, edge functions clean up on read
