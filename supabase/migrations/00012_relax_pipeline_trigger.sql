-- ════════════════════════════════════════════════════════════════════════
-- Relax pipeline transition trigger for Kanban drag-and-drop
-- Allow free movement between most stages, keep critical validations only
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.validate_pipeline_transition()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Critical rule: cannot go to final_review without figma_link
  IF NEW.status = 'final_review' AND (NEW.figma_link IS NULL OR TRIM(NEW.figma_link) = '') THEN
    RAISE EXCEPTION 'Adicione o link do Figma antes de enviar para revisão final.';
  END IF;

  -- Critical rule: cannot go to copy_review without text
  IF NEW.status IN ('copy_review', 'copy_approved') AND
     (NEW.raw_text IS NULL OR TRIM(NEW.raw_text) = '') AND
     (NEW.improved_text IS NULL OR TRIM(NEW.improved_text) = '') THEN
    RAISE EXCEPTION 'Escreva o texto antes de avançar para revisão de copy.';
  END IF;

  -- Critical rule: scheduled requires date+time
  IF NEW.status = 'scheduled' AND (NEW.scheduled_date IS NULL OR NEW.scheduled_time IS NULL) THEN
    RAISE EXCEPTION 'Defina data e horário antes de agendar.';
  END IF;

  -- All other transitions are allowed (free Kanban movement)
  RETURN NEW;
END;
$$;
