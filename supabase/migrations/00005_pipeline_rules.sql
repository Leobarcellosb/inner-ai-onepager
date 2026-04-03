-- ════════════════════════════════════════════════════════════════════════
-- Pipeline transition rules (database-level enforcement)
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.validate_pipeline_transition()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  allowed_transitions jsonb := '{
    "idea":          ["writing"],
    "writing":       ["idea", "copy_review"],
    "copy_review":   ["writing", "copy_approved"],
    "copy_approved": ["copy_review", "design_queue"],
    "design_queue":  ["copy_approved", "designing"],
    "designing":     ["design_queue", "final_review"],
    "final_review":  ["designing", "approved"],
    "approved":      ["final_review", "scheduled"],
    "scheduled":     ["approved", "published"],
    "published":     ["scheduled"]
  }'::jsonb;
  allowed jsonb;
BEGIN
  -- Skip if status didn't change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  allowed := allowed_transitions -> OLD.status::text;

  IF allowed IS NULL OR NOT allowed ? NEW.status::text THEN
    RAISE EXCEPTION 'Transição inválida: % → %. Avance ou retroceda uma etapa por vez.',
      OLD.status, NEW.status;
  END IF;

  -- Rule: cannot go to final_review without figma_link
  IF NEW.status = 'final_review' AND (NEW.figma_link IS NULL OR TRIM(NEW.figma_link) = '') THEN
    RAISE EXCEPTION 'Adicione o link do Figma antes de enviar para revisão final.';
  END IF;

  -- Rule: cannot go to copy_review without text
  IF NEW.status = 'copy_review' AND (NEW.raw_text IS NULL OR TRIM(NEW.raw_text) = '') AND (NEW.improved_text IS NULL OR TRIM(NEW.improved_text) = '') THEN
    RAISE EXCEPTION 'Escreva o texto antes de enviar para revisão.';
  END IF;

  RETURN NEW;
END;
$$;

-- Drop if exists to avoid duplicate
DROP TRIGGER IF EXISTS validate_pipeline_trigger ON public.contents;
CREATE TRIGGER validate_pipeline_trigger
  BEFORE UPDATE ON public.contents
  FOR EACH ROW EXECUTE FUNCTION public.validate_pipeline_transition();
