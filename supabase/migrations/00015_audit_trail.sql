-- ════════════════════════════════════════════════════════════════════════
-- Audit trail for critical actions
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs; any authenticated user can write
CREATE POLICY "admins_read_audit" ON public.audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "auth_insert_audit" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

CREATE INDEX idx_audit_action ON public.audit_log (action, created_at DESC);
CREATE INDEX idx_audit_entity ON public.audit_log (entity_type, entity_id);
