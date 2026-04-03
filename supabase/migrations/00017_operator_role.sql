-- ════════════════════════════════════════════════════════════════════════
-- Add 'operator' role and auto-assign to new users
-- ════════════════════════════════════════════════════════════════════════

-- Add operator to enum (idempotent)
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operator';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Auto-assign 'operator' role to new users on signup
CREATE OR REPLACE FUNCTION public.auto_assign_operator_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Only assign if user has no roles yet
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operator')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_assign_role_on_signup ON auth.users;
CREATE TRIGGER auto_assign_role_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_operator_role();

-- Assign 'operator' to existing users that have no role
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'operator'::app_role
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE r.id IS NULL
ON CONFLICT DO NOTHING;
