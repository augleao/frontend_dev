-- Migration: Add ato_id to uploads and populate from existing columns
-- Date: 2025-11-23
-- WARNING: Run a full DB backup before applying.

BEGIN;

-- 1) Add new column (nullable to be safe)
ALTER TABLE public.uploads
  ADD COLUMN IF NOT EXISTS ato_id bigint;

-- 2) Populate from possible legacy columns
-- If you have both columns, averbacao_id takes precedence, then procedimento_id
UPDATE public.uploads
SET ato_id = averbacao_id
WHERE averbacao_id IS NOT NULL AND (ato_id IS NULL OR ato_id = 0);

UPDATE public.uploads
SET ato_id = procedimento_id
WHERE procedimento_id IS NOT NULL AND (ato_id IS NULL OR ato_id = 0);

-- 3) Create an index to speed lookups by ato_id
CREATE INDEX IF NOT EXISTS uploads_ato_id_idx ON public.uploads (ato_id);

-- 4) Optional: add FK constraint (uncomment and adjust target table if you have a shared 'atos' table)
-- ALTER TABLE public.uploads ADD CONSTRAINT uploads_ato_id_fkey FOREIGN KEY (ato_id) REFERENCES public.atos(id);

COMMIT;

-- Verification suggestions:
-- 1) Check rows still missing ato_id while having legacy ids:
-- SELECT COUNT(*) FROM public.uploads WHERE ato_id IS NULL AND (averbacao_id IS NOT NULL OR procedimento_id IS NOT NULL);

-- 2) Check total with ato_id populated:
-- SELECT COUNT(*) FROM public.uploads WHERE ato_id IS NOT NULL;

-- Rollback (only if you must undo):
-- NOTE: dropping the column will lose the populated data. Keep backups.
-- BEGIN;
-- DROP INDEX IF EXISTS uploads_ato_id_idx;
-- ALTER TABLE public.uploads DROP COLUMN IF EXISTS ato_id;
-- COMMIT;
