-- Migration: Add ato_type column and composite index on (ato_id, ato_type)
-- Date: 2025-11-23
-- WARNING: Run a full DB backup before applying.

BEGIN;

-- 1) Add new column for type discriminator (nullable for safety)
ALTER TABLE public.uploads
  ADD COLUMN IF NOT EXISTS ato_type text;

-- 2) Populate ato_type based on legacy columns
UPDATE public.uploads
SET ato_type = 'averbacao'
WHERE averbacao_id IS NOT NULL AND (ato_type IS NULL OR ato_type = '');

UPDATE public.uploads
SET ato_type = 'procedimento'
WHERE procedimento_id IS NOT NULL AND (ato_type IS NULL OR ato_type = '');

-- 3) Create composite index to speed queries by ato_id + ato_type
CREATE INDEX IF NOT EXISTS uploads_ato_id_type_idx ON public.uploads (ato_id, ato_type);

COMMIT;

-- Verification suggestions:
-- SELECT COUNT(*) FROM public.uploads WHERE ato_type IS NULL AND (averbacao_id IS NOT NULL OR procedimento_id IS NOT NULL);
-- SELECT COUNT(*) FROM public.uploads WHERE ato_type = 'averbacao';
-- SELECT COUNT(*) FROM public.uploads WHERE ato_type = 'procedimento';

-- Rollback (if needed):
-- BEGIN;
-- DROP INDEX IF EXISTS uploads_ato_id_type_idx;
-- ALTER TABLE public.uploads DROP COLUMN IF EXISTS ato_type;
-- COMMIT;
