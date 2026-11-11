ALTER TABLE public.voyages
  ADD COLUMN IF NOT EXISTS paused_lat double precision,
  ADD COLUMN IF NOT EXISTS paused_lng double precision,
  ADD COLUMN IF NOT EXISTS paused_progress double precision,
  ADD COLUMN IF NOT EXISTS paused_remaining double precision,
  ADD COLUMN IF NOT EXISTS stop_message text;
