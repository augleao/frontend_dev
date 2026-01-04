-- Migration: create uploads_cleanup_logs table
-- Run with your usual migration tool or `psql`.

CREATE TABLE IF NOT EXISTS public.uploads_cleanup_logs (
  id bigserial PRIMARY KEY,
  upload_id bigint REFERENCES public.uploads(id) ON DELETE CASCADE,
  performed_by text,
  action text NOT NULL,
  details jsonb,
  performed_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS uploads_cleanup_logs_upload_idx ON public.uploads_cleanup_logs (upload_id);
