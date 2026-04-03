-- ════════════════════════════════════════════════════════════════════════
-- Pipeline status migration: rename enum values to English pipeline
-- ════════════════════════════════════════════════════════════════════════

-- 1. Drop dependent objects (triggers that reference status values)
DROP TRIGGER IF EXISTS validate_schedule_trigger ON public.contents;
DROP FUNCTION IF EXISTS public.validate_schedule_for_status();

-- 2. Convert column to text temporarily
ALTER TABLE public.contents ALTER COLUMN status SET DEFAULT 'idea';
ALTER TABLE public.contents ALTER COLUMN status TYPE text;

-- 3. Migrate values
UPDATE public.contents SET status = 'idea' WHERE status = 'ideia';
UPDATE public.contents SET status = 'writing' WHERE status = 'rascunho';
UPDATE public.contents SET status = 'copy_approved' WHERE status IN ('em_revisao', 'aguardando_design');
UPDATE public.contents SET status = 'designing' WHERE status = 'em_design';
UPDATE public.contents SET status = 'approved' WHERE status = 'pronto';
UPDATE public.contents SET status = 'published' WHERE status = 'publicado';

-- 4. Drop old enum and create new one
DROP TYPE IF EXISTS public.content_status;
CREATE TYPE public.content_status AS ENUM (
  'idea', 'writing', 'copy_approved', 'designing', 'approved', 'scheduled', 'published'
);

-- 5. Convert column back to enum
ALTER TABLE public.contents ALTER COLUMN status TYPE content_status USING status::content_status;
ALTER TABLE public.contents ALTER COLUMN status SET DEFAULT 'idea';

-- 6. Recreate schedule validation with new status values
CREATE OR REPLACE FUNCTION public.validate_schedule_for_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.scheduled_date IS NOT NULL AND NEW.scheduled_time IS NULL THEN
    RAISE EXCEPTION 'Preencha também o horário da postagem.';
  END IF;
  IF NEW.scheduled_time IS NOT NULL AND NEW.scheduled_date IS NULL THEN
    RAISE EXCEPTION 'Preencha também a data da postagem.';
  END IF;
  IF NEW.status IN ('scheduled', 'published') THEN
    IF NEW.scheduled_date IS NULL THEN
      RAISE EXCEPTION 'Defina a data da postagem antes de concluir este conteúdo.';
    END IF;
    IF NEW.scheduled_time IS NULL THEN
      RAISE EXCEPTION 'Defina o horário da postagem antes de concluir este conteúdo.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_schedule_trigger
  BEFORE INSERT OR UPDATE ON public.contents
  FOR EACH ROW EXECUTE FUNCTION public.validate_schedule_for_status();
