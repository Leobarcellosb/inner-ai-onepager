-- Add is_active flag to references for soft-deactivation
ALTER TABLE public.references ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
