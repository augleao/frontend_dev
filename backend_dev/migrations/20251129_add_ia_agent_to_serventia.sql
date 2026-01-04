-- Add ia_agent column to serventia so each serventia can store a preferred IA agent/model
-- This migration is safe to run multiple times: it uses IF EXISTS / IF NOT EXISTS guards

-- Try to add to a possible namespaced table first (db_yq0x.public.serventia)
ALTER TABLE IF EXISTS db_yq0x.public.serventia
  ADD COLUMN IF NOT EXISTS ia_agent TEXT;

-- Also add to the common public.serventia table if present
ALTER TABLE IF EXISTS public.serventia
  ADD COLUMN IF NOT EXISTS ia_agent TEXT;

-- Optional: add an index to speed lookups by codigo_serventia and nome_abreviado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_serventia_ia_agent_codigo' AND n.nspname = 'public'
  ) THEN
    BEGIN
      -- create a simple index on codigo_serventia to speed exact-match queries
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'serventia' AND column_name = 'codigo_serventia') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_serventia_ia_agent_codigo ON public.serventia (codigo_serventia)';
      END IF;
    END;
  END IF;
END$$;
