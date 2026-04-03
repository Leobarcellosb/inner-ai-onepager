-- Carousel script storage on contents
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS carousel_script JSONB;
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS carousel_slide_count INTEGER;
