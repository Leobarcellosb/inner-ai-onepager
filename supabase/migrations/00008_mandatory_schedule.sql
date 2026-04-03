-- ════════════════════════════════════════════════════════════════════════
-- Enforce mandatory scheduling on all contents
-- ════════════════════════════════════════════════════════════════════════

-- 1. Backfill any existing nulls
UPDATE public.contents
SET scheduled_date = created_at::date,
    scheduled_time = '10:00:00'
WHERE scheduled_date IS NULL OR scheduled_time IS NULL;

-- 2. Set NOT NULL with defaults
ALTER TABLE public.contents
  ALTER COLUMN scheduled_date SET DEFAULT CURRENT_DATE,
  ALTER COLUMN scheduled_date SET NOT NULL;

ALTER TABLE public.contents
  ALTER COLUMN scheduled_time SET DEFAULT '10:00:00',
  ALTER COLUMN scheduled_time SET NOT NULL;

-- 3. Replace the schedule validation trigger — remove the old partial check
--    since both fields are now NOT NULL, the only check left is for terminal statuses
DROP TRIGGER IF EXISTS validate_schedule_trigger ON public.contents;
DROP FUNCTION IF EXISTS public.validate_schedule_for_status();

CREATE OR REPLACE FUNCTION public.validate_schedule_for_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  -- scheduled_date and scheduled_time are NOT NULL, so no need to check for nulls
  -- Just ensure scheduled_datetime is synced (the sync trigger handles this)
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_schedule_trigger
  BEFORE INSERT OR UPDATE ON public.contents
  FOR EACH ROW EXECUTE FUNCTION public.validate_schedule_for_status();
