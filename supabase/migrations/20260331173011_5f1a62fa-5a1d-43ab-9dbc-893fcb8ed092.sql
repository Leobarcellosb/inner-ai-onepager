
-- Trigger to auto-sync scheduled_datetime from scheduled_date + scheduled_time
CREATE OR REPLACE FUNCTION public.sync_scheduled_datetime()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.scheduled_date IS NOT NULL AND NEW.scheduled_time IS NOT NULL THEN
    NEW.scheduled_datetime := (NEW.scheduled_date || 'T' || NEW.scheduled_time)::timestamp AT TIME ZONE COALESCE(NEW.posting_timezone, 'America/Sao_Paulo');
  ELSE
    NEW.scheduled_datetime := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_scheduled_datetime_trigger
  BEFORE INSERT OR UPDATE ON public.contents
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_scheduled_datetime();

-- Trigger to validate schedule is present for terminal statuses
CREATE OR REPLACE FUNCTION public.validate_schedule_for_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('pronto', 'publicado') AND (NEW.scheduled_date IS NULL OR NEW.scheduled_time IS NULL) THEN
    RAISE EXCEPTION 'Conteúdos com status "pronto" ou "publicado" precisam ter data e horário de agendamento definidos.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_schedule_trigger
  BEFORE INSERT OR UPDATE ON public.contents
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_schedule_for_status();

-- Re-attach the handle_new_user trigger (it exists as function but trigger may be missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END;
$$;
