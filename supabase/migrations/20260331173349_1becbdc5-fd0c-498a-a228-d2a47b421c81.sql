
CREATE OR REPLACE FUNCTION public.validate_schedule_for_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Partial schedule validation (applies to all statuses)
  IF NEW.scheduled_date IS NOT NULL AND NEW.scheduled_time IS NULL THEN
    RAISE EXCEPTION 'Preencha também o horário da postagem.';
  END IF;

  IF NEW.scheduled_time IS NOT NULL AND NEW.scheduled_date IS NULL THEN
    RAISE EXCEPTION 'Preencha também a data da postagem.';
  END IF;

  -- Terminal status validation
  IF NEW.status IN ('pronto', 'publicado') THEN
    IF NEW.scheduled_date IS NULL AND NEW.scheduled_time IS NULL THEN
      RAISE EXCEPTION 'Defina a data e o horário da postagem antes de concluir este conteúdo.';
    END IF;
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
