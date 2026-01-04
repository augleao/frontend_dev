-- Migration: add user_id column and index to tracker_events
ALTER TABLE public.tracker_events
  ADD COLUMN IF NOT EXISTS user_id BIGINT NULL;

CREATE INDEX IF NOT EXISTS idx_tracker_user_id ON public.tracker_events(user_id);
