-- Add quality rating to references: strong / neutral / weak
ALTER TABLE public.references ADD COLUMN IF NOT EXISTS quality TEXT NOT NULL DEFAULT 'neutral'
  CHECK (quality IN ('strong', 'neutral', 'weak'));
