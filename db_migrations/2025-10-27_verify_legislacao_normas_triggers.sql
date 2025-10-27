-- Verificar triggers e funções relacionadas a legislacao_normas

-- Triggers na tabela
SELECT event_object_table AS table,
       trigger_name,
       action_timing,
       event_manipulation,
       action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'legislacao_normas'
ORDER BY trigger_name;

-- Funções relacionadas
SELECT n.nspname AS schema,
       p.proname AS function,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('set_timestamp','legislacao_normas_set_searchable');