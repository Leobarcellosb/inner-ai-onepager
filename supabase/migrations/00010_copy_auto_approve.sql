-- ════════════════════════════════════════════════════════════════════════
-- Auto-approve copy tracking fields
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS copy_auto_approved BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS copy_auto_approved_by UUID REFERENCES auth.users(id);
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS copy_auto_approved_at TIMESTAMPTZ;
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS source_origin TEXT NOT NULL DEFAULT 'manual';
