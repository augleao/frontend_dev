-- Create table for Averbações Gratuitas
-- Safe to run multiple times (IF NOT EXISTS guards)

CREATE TABLE IF NOT EXISTS public.averbacoes_gratuitas (
    id              BIGSERIAL PRIMARY KEY,
    data            DATE NOT NULL,
    tipo            TEXT NOT NULL,
    tipo_outro      TEXT,
    descricao       TEXT,
    ressarcivel     BOOLEAN NOT NULL DEFAULT FALSE,
    observacoes     TEXT,
    livro           TEXT,
    folha           TEXT,
    termo           TEXT,
    nomes           TEXT,
    codigo_tributario TEXT,
    pdf_filename    TEXT,
    pdf_url         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Generic trigger function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_timestamp()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to keep updated_at fresh
DROP TRIGGER IF EXISTS set_timestamp_on_averbacoes_gratuitas ON public.averbacoes_gratuitas;
CREATE TRIGGER set_timestamp_on_averbacoes_gratuitas
BEFORE UPDATE ON public.averbacoes_gratuitas
FOR EACH ROW EXECUTE FUNCTION public.set_timestamp();

-- Helpful indexes for filtering
CREATE INDEX IF NOT EXISTS idx_averbacoes_gratuitas_data
    ON public.averbacoes_gratuitas (data);

CREATE INDEX IF NOT EXISTS idx_averbacoes_gratuitas_ressarcivel
    ON public.averbacoes_gratuitas (ressarcivel);

CREATE INDEX IF NOT EXISTS idx_averbacoes_gratuitas_tipo
    ON public.averbacoes_gratuitas (tipo);

-- Optional: narrow composite index if you often filter by (data range + ressarcivel)
-- CREATE INDEX IF NOT EXISTS idx_averbacoes_gratuitas_data_ressarcivel
--     ON public.averbacoes_gratuitas (data, ressarcivel);

-- Verification query (non-destructive)
-- SELECT to_regclass('public.averbacoes_gratuitas') AS table_exists;