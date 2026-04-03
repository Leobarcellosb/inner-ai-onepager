-- ════════════════════════════════════════════════════════════════════════
-- Fix: add FK from contents.created_by to profiles.id
-- so PostgREST can resolve the 'profiles(name)' join
-- ════════════════════════════════════════════════════════════════════════

-- contents.created_by already references auth.users(id)
-- profiles.id also references auth.users(id)
-- PostgREST needs a direct FK path: contents → profiles

-- Add FK (will not duplicate if the column already references auth.users)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'contents_created_by_profiles_fk'
  ) THEN
    ALTER TABLE public.contents
      ADD CONSTRAINT contents_created_by_profiles_fk
      FOREIGN KEY (created_by) REFERENCES public.profiles(id);
  END IF;
END $$;
