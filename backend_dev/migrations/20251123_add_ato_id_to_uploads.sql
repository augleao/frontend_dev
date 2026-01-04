-- Migration: add ato_id to public.uploads and populate from existing fields

ALTER TABLE public.uploads ADD COLUMN IF NOT EXISTS ato_id bigint;

-- Populate from averbacao_id if present
UPDATE public.uploads SET ato_id = averbacao_id WHERE averbacao_id IS NOT NULL;

-- Populate from procedimento_id where ato_id is still null
UPDATE public.uploads SET ato_id = procedimento_id WHERE procedimento_id IS NOT NULL AND (ato_id IS NULL OR ato_id = 0);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_uploads_ato_id ON public.uploads(ato_id);
