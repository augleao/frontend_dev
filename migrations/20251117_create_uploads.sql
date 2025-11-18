-- Migration: create uploads table
-- Adapt and run this SQL in the Postgres database used by your backend

CREATE TABLE IF NOT EXISTS public.uploads (
  id BIGSERIAL PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  stored_name TEXT,
  original_name TEXT,
  bucket TEXT,
  content_type TEXT,
  size BIGINT,
  status TEXT NOT NULL DEFAULT 'prepared',
  metadata JSONB,
  averbacao_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- Optional: if you want a foreign key to your averbacoes table, uncomment and adapt the table name
-- ALTER TABLE public.uploads
--   ADD CONSTRAINT uploads_averbacao_fk FOREIGN KEY (averbacao_id) REFERENCES public.averbacoes (id) ON DELETE SET NULL;

-- Trigger to update updated_at automatically
CREATE OR REPLACE FUNCTION public.fn_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_uploads_updated_at ON public.uploads;
CREATE TRIGGER trg_uploads_updated_at
BEFORE UPDATE ON public.uploads
FOR EACH ROW
EXECUTE FUNCTION public.fn_update_updated_at();

-- Small helper to inspect if table exists (run separately if needed):
-- SELECT to_regclass('public.uploads');

COMMENT ON TABLE public.uploads IS 'Tabela para armazenar metadados de uploads (presigned)';
