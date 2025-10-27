-- Verificação da tabela public.legislacao_normas

-- 1) Existe?
SELECT to_regclass('public.legislacao_normas') AS table_exists;

-- 2) Colunas
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'legislacao_normas'
ORDER BY ordinal_position;

-- 3) Índices
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'legislacao_normas'
ORDER BY indexname;

-- 4) Teste seguro de inserção (ROLLBACK)
BEGIN;
INSERT INTO public.legislacao_normas (indexador, base_legal, titulo, artigo, jurisdicao, texto, tags)
VALUES (
  'averbacao_divorcio',
  'Provimento 149/2023 CNJ',
  'Averbação de Divórcio - Base CNJ',
  'Art. 1º',
  'CNJ',
  'Texto de exemplo do dispositivo legal aplicável à averbação de divórcio.',
  ARRAY['averbacao','divorcio']
);

-- Busca textual (exemplo):
SELECT id, titulo
FROM public.legislacao_normas
WHERE searchable @@ to_tsquery('portuguese', 'divorcio & averbacao');

-- Limpa o teste
ROLLBACK;