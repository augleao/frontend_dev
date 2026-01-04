ALTER TABLE public.averbacoes_gratuitas
  ADD COLUMN IF NOT EXISTS anexo_url TEXT,
  ADD COLUMN IF NOT EXISTS anexo_metadata JSONB;
