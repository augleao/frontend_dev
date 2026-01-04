-- Tabela para controlar envios de relatórios obrigatórios
CREATE TABLE IF NOT EXISTS public.relatorios_obrigatorios_envios (
  id SERIAL PRIMARY KEY,
  serventia VARCHAR(120) NOT NULL,
  relatorio_id VARCHAR(100) NOT NULL,
  competencia DATE NOT NULL,
  enviado BOOLEAN NOT NULL DEFAULT FALSE,
  data_envio DATE NULL,
  meios TEXT[] NOT NULL DEFAULT '{}',
  protocolo TEXT NULL,
  responsavel TEXT NULL,
  observacoes TEXT NULL,
  usuario_id INTEGER NULL REFERENCES public.users(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_relatorios_obrigatorios_envios UNIQUE (serventia, relatorio_id, competencia)
);

CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_relatorios_obrigatorios_envios ON public.relatorios_obrigatorios_envios;
CREATE TRIGGER set_timestamp_relatorios_obrigatorios_envios
BEFORE UPDATE ON public.relatorios_obrigatorios_envios
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS idx_relatorios_obrigatorios_envios_serventia_competencia
  ON public.relatorios_obrigatorios_envios (serventia, competencia);

CREATE INDEX IF NOT EXISTS idx_relatorios_obrigatorios_envios_relatorio_competencia
  ON public.relatorios_obrigatorios_envios (relatorio_id, competencia);
