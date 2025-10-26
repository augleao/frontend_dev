-- Verify selos_execucao_servico schema and data after unifying selos usage
-- Schema: public (adjust if needed)

-- 1) Column nullability (expect YES / false)
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'selos_execucao_servico'
  AND column_name = 'execucao_servico_id';

SELECT a.attname, a.attnotnull
FROM pg_attribute a
JOIN pg_class c ON a.attrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relname = 'selos_execucao_servico'
  AND a.attname = 'execucao_servico_id';

-- 2) Constraints: list CHECK constraints
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.selos_execucao_servico'::regclass
  AND contype = 'c';

-- 3) Indexes present
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'selos_execucao_servico';

-- 4) Data consistency checks
-- Rows that violate mutual exclusivity (both ids set or both null)
SELECT id, execucao_servico_id, averbacao_id, origem
FROM public.selos_execucao_servico
WHERE (execucao_servico_id IS NOT NULL AND averbacao_id IS NOT NULL)
   OR (execucao_servico_id IS NULL AND averbacao_id IS NULL);

-- Rows where origem doesn't match context (informational)
SELECT id, execucao_servico_id, averbacao_id, origem
FROM public.selos_execucao_servico
WHERE (execucao_servico_id IS NOT NULL AND origem <> 'execucao')
   OR (execucao_servico_id IS NULL AND averbacao_id IS NOT NULL AND origem NOT IN ('averbacao','averbacao_gratuita','gratuito'));

-- =====================
-- Optional remediation
-- =====================
-- A) Add helpful indexes if missing
CREATE INDEX IF NOT EXISTS idx_selos_execucao_servico_averbacao_id
  ON public.selos_execucao_servico (averbacao_id);

CREATE INDEX IF NOT EXISTS idx_selos_execucao_servico_codigo_tributario
  ON public.selos_execucao_servico (codigo_tributario);

-- B) Add mutual exclusivity CHECK if missing (idempotent drop+add)
ALTER TABLE public.selos_execucao_servico
  DROP CONSTRAINT IF EXISTS selos_execucao_servico_context_chk;

ALTER TABLE public.selos_execucao_servico
  ADD CONSTRAINT selos_execucao_servico_context_chk
  CHECK (
    (execucao_servico_id IS NOT NULL AND averbacao_id IS NULL)
    OR (execucao_servico_id IS NULL AND averbacao_id IS NOT NULL)
  );

-- C) Normalize origem for averbacao-linked rows
UPDATE public.selos_execucao_servico
SET origem = 'averbacao'
WHERE averbacao_id IS NOT NULL
  AND origem <> 'averbacao';
