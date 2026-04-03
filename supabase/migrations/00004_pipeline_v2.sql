-- ════════════════════════════════════════════════════════════════════════
-- Pipeline v2: 10-stage production flow + operational fields
-- Works from either the old (Portuguese) or v1 (English) enum
-- ════════════════════════════════════════════════════════════════════════

-- 1. Drop dependent trigger
DROP TRIGGER IF EXISTS validate_schedule_trigger ON public.contents;
DROP FUNCTION IF EXISTS public.validate_schedule_for_status();

-- 2. Convert to text (drop default first — old enum doesn't know 'idea')
ALTER TABLE public.contents ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.contents ALTER COLUMN status TYPE text;

-- 3. Normalize any old Portuguese values to English v1
UPDATE public.contents SET status = 'idea' WHERE status = 'ideia';
UPDATE public.contents SET status = 'writing' WHERE status = 'rascunho';
UPDATE public.contents SET status = 'copy_approved' WHERE status IN ('em_revisao', 'aguardando_design');
UPDATE public.contents SET status = 'designing' WHERE status = 'em_design';
UPDATE public.contents SET status = 'approved' WHERE status = 'pronto';
UPDATE public.contents SET status = 'published' WHERE status = 'publicado';

-- 4. Map v1 values to v2 where they split
-- copy_approved now splits into copy_review → copy_approved → design_queue
-- approved now splits into final_review → approved
-- (existing data keeps the "approved" side of each split)

-- 5. Drop old enum, create v2
DROP TYPE IF EXISTS public.content_status;
CREATE TYPE public.content_status AS ENUM (
  'idea',
  'writing',
  'copy_review',
  'copy_approved',
  'design_queue',
  'designing',
  'final_review',
  'approved',
  'scheduled',
  'published'
);

-- 6. Convert column to new enum
ALTER TABLE public.contents ALTER COLUMN status TYPE content_status USING status::content_status;
ALTER TABLE public.contents ALTER COLUMN status SET DEFAULT 'idea';

-- 7. Add priority enum
DO $$ BEGIN
  CREATE TYPE public.content_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. Add operational columns
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS current_stage_owner UUID REFERENCES auth.users(id);
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS copy_reviewer_id UUID REFERENCES auth.users(id);
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS designer_id UUID REFERENCES auth.users(id);
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS final_approver_id UUID REFERENCES auth.users(id);
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS approved_copy_at TIMESTAMPTZ;
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS sent_to_design_at TIMESTAMPTZ;
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS design_started_at TIMESTAMPTZ;
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS final_approved_at TIMESTAMPTZ;
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS priority content_priority NOT NULL DEFAULT 'medium';
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'post';

-- 9. Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contents_status ON public.contents (status);
CREATE INDEX IF NOT EXISTS idx_contents_designer ON public.contents (designer_id) WHERE designer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contents_priority ON public.contents (priority);

-- 10. Recreate schedule validation with new statuses
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
      RAISE EXCEPTION 'Defina a data da postagem antes de agendar ou publicar.';
    END IF;
    IF NEW.scheduled_time IS NULL THEN
      RAISE EXCEPTION 'Defina o horário da postagem antes de agendar ou publicar.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_schedule_trigger
  BEFORE INSERT OR UPDATE ON public.contents
  FOR EACH ROW EXECUTE FUNCTION public.validate_schedule_for_status();

-- 11. Auto-stamp milestone dates on status transitions
CREATE OR REPLACE FUNCTION public.stamp_pipeline_milestones()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'copy_approved' THEN NEW.approved_copy_at := COALESCE(NEW.approved_copy_at, now());
      WHEN 'design_queue'  THEN NEW.sent_to_design_at := COALESCE(NEW.sent_to_design_at, now());
      WHEN 'designing'     THEN NEW.design_started_at := COALESCE(NEW.design_started_at, now());
      WHEN 'approved'      THEN NEW.final_approved_at := COALESCE(NEW.final_approved_at, now());
      WHEN 'published'     THEN NEW.published_at := COALESCE(NEW.published_at, now());
      ELSE NULL;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER stamp_milestones_trigger
  BEFORE UPDATE ON public.contents
  FOR EACH ROW EXECUTE FUNCTION public.stamp_pipeline_milestones();
