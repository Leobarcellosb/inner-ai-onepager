ALTER TABLE public.contents
  ADD COLUMN scheduled_date date,
  ADD COLUMN scheduled_time time,
  ADD COLUMN scheduled_datetime timestamptz,
  ADD COLUMN posting_timezone text NOT NULL DEFAULT 'America/Sao_Paulo';