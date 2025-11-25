-- Migration: adicionar coluna execucao_id às averbacoes_gratuitas
-- Data: 2025-11-25
-- Observação: este arquivo usa o esquema `public`. Se o seu ambiente exige o prefixo
-- `db_yq0x.public` (como em alguns DDLs exportados), troque `public` por `db_yq0x.public`.

BEGIN;

-- 1) Adicionar coluna (se ainda não existir)
ALTER TABLE public.averbacoes_gratuitas
  ADD COLUMN IF NOT EXISTS execucao_id varchar(64);

-- 2) Backfill: popular execucao_id para registros existentes com prefixo 'AV'
-- Usa o id da linha para criar o identificador (ex.: AV123)
UPDATE public.averbacoes_gratuitas
  SET execucao_id = 'AV' || id::text
  WHERE execucao_id IS NULL;

-- 3) Garantir unicidade quando presente
CREATE UNIQUE INDEX IF NOT EXISTS idx_averbacoes_execucao_id ON public.averbacoes_gratuitas (execucao_id) WHERE execucao_id IS NOT NULL;

-- 4) Criar função que popula execucao_id automaticamente em novos inserts
CREATE OR REPLACE FUNCTION public.averbacoes_set_execucao_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.execucao_id IS NULL OR NEW.execucao_id = '' THEN
    -- Quando possível, use o id já presente (bigserial aplicado antes do trigger);
    -- caso contrário, gera um valor a partir da sequência como fallback.
    IF NEW.id IS NOT NULL THEN
      NEW.execucao_id := 'AV' || NEW.id::text;
    ELSE
      NEW.execucao_id := 'AV' || nextval('averbacoes_gratuitas_id_seq')::text;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5) Criar trigger BEFORE INSERT para usar a função
DROP TRIGGER IF EXISTS trg_averbacoes_set_execucao_id ON public.averbacoes_gratuitas;
CREATE TRIGGER trg_averbacoes_set_execucao_id
  BEFORE INSERT ON public.averbacoes_gratuitas
  FOR EACH ROW
  EXECUTE FUNCTION public.averbacoes_set_execucao_id();

COMMIT;

-- Observações e recomendações:
-- - A coluna `execucao_id` foi criada como varchar(64) e preenchida para linhas antigas
--   com o formato `AV<id>` (por exemplo, `AV123`).
-- - Um índice único parcial garante que não haverá duplicatas quando o campo estiver presente.
-- - A trigger preenche `execucao_id` automaticamente em novos inserts quando o campo
--   não for informado, usando 'AV' + id. Se você preferir outro formato (zeros à esquerda,
--   prefixo diferente), posso ajustar.
