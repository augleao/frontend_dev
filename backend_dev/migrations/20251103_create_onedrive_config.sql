CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.onedrive_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  tenant TEXT NOT NULL DEFAULT 'consumers',
  refresh_token TEXT NOT NULL,
  folder_path TEXT NOT NULL DEFAULT 'Averbacoes',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_onedrive_config_singleton
  ON public.onedrive_config ((true));

DROP TRIGGER IF EXISTS set_timestamp_onedrive_config ON public.onedrive_config;
CREATE TRIGGER set_timestamp_onedrive_config
BEFORE UPDATE ON public.onedrive_config
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_updated_at();
