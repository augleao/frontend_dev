-- Add ia_agent_fallback1 and ia_agent_fallback2 to serventia table in both namespaced and public schemas
-- Safe: only add column if it does not exist

-- For namespaced schema (if present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'db_yq0x' AND table_name = 'serventia' AND column_name = 'ia_agent_fallback1'
  ) THEN
    EXECUTE 'ALTER TABLE db_yq0x.public.serventia ADD COLUMN ia_agent_fallback1 TEXT';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'db_yq0x' AND table_name = 'serventia' AND column_name = 'ia_agent_fallback2'
  ) THEN
    EXECUTE 'ALTER TABLE db_yq0x.public.serventia ADD COLUMN ia_agent_fallback2 TEXT';
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- namespaced table does not exist; ignore
  RAISE NOTICE 'db_yq0x.public.serventia not present; skipping namespaced alterations';
END$$;

-- For public schema
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'serventia' AND column_name = 'ia_agent_fallback1'
  ) THEN
    ALTER TABLE public.serventia ADD COLUMN ia_agent_fallback1 TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'serventia' AND column_name = 'ia_agent_fallback2'
  ) THEN
    ALTER TABLE public.serventia ADD COLUMN ia_agent_fallback2 TEXT;
  END IF;
END$$;

-- Optionally initialize fallbacks to NULL for existing rows (no-op as columns default to NULL)

-- End of migration
