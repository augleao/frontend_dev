-- SQL para preparar o banco de dados para a funcionalidade de importar atos

-- 1. Adicionar colunas opcionais na tabela atos_praticados para rastrear importações
ALTER TABLE atos_praticados ADD COLUMN IF NOT EXISTS origem_importacao VARCHAR(255) DEFAULT NULL;
ALTER TABLE atos_praticados ADD COLUMN IF NOT EXISTS selo_inicial INTEGER DEFAULT NULL;
ALTER TABLE atos_praticados ADD COLUMN IF NOT EXISTS selo_final INTEGER DEFAULT NULL;

-- 2. Comentários das colunas para documentação
COMMENT ON COLUMN atos_praticados.origem_importacao IS 'Origem da importação: selos_execucao_servico, manual, etc.';
COMMENT ON COLUMN atos_praticados.selo_inicial IS 'ID do primeiro selo da sequência importada';
COMMENT ON COLUMN atos_praticados.selo_final IS 'ID do último selo da sequência importada';

-- 3. Criar índices para melhorar performance das consultas de importação
CREATE INDEX IF NOT EXISTS idx_atos_praticados_origem ON atos_praticados(origem_importacao);
CREATE INDEX IF NOT EXISTS idx_atos_praticados_selo_inicial ON atos_praticados(selo_inicial);
CREATE INDEX IF NOT EXISTS idx_atos_praticados_importacao_lookup ON atos_praticados(data, codigo, usuario, origem_importacao);

-- 4. Verificar se a tabela selos_execucao_servico existe e tem as colunas necessárias
-- (Execute apenas para verificação - não irá alterar nada se a tabela já estiver correta)
DO $$
BEGIN
    -- Verificar se a tabela existe
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'selos_execucao_servico') THEN
        RAISE NOTICE 'Tabela selos_execucao_servico encontrada ✓';
        
        -- Verificar colunas essenciais
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'selos_execucao_servico' AND column_name = 'data_execucao') THEN
            RAISE NOTICE 'Coluna data_execucao encontrada ✓';
        ELSE
            RAISE WARNING 'Coluna data_execucao NÃO encontrada - necessária para importação';
        END IF;
        
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'selos_execucao_servico' AND column_name = 'codigo') THEN
            RAISE NOTICE 'Coluna codigo encontrada ✓';
        ELSE
            RAISE WARNING 'Coluna codigo NÃO encontrada - necessária para importação';
        END IF;
        
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'selos_execucao_servico' AND column_name = 'usuario') THEN
            RAISE NOTICE 'Coluna usuario encontrada ✓';
        ELSE
            RAISE WARNING 'Coluna usuario NÃO encontrada - necessária para importação';
        END IF;
        
    ELSE
        RAISE WARNING 'Tabela selos_execucao_servico NÃO encontrada - necessária para importação';
    END IF;
END $$;

-- 5. Query de teste para verificar dados disponíveis para importação
-- (Descomente e execute para testar)
/*
SELECT 
    COUNT(*) as total_registros,
    COUNT(DISTINCT data_execucao) as dias_com_dados,
    COUNT(DISTINCT usuario) as usuarios_diferentes,
    MIN(data_execucao) as data_mais_antiga,
    MAX(data_execucao) as data_mais_recente
FROM selos_execucao_servico;
*/

-- 6. Query para verificar se existem atos já importados
-- (Descomente e execute para testar)
/*
SELECT 
    origem_importacao,
    COUNT(*) as quantidade
FROM atos_praticados 
WHERE origem_importacao IS NOT NULL
GROUP BY origem_importacao;
*/

RAISE NOTICE 'Setup do banco de dados para importação de atos concluído!';
RAISE NOTICE 'Próximos passos:';
RAISE NOTICE '1. Implemente a rota backend usando o arquivo backend-route-importar-servicos.js';
RAISE NOTICE '2. Teste a funcionalidade no frontend';
RAISE NOTICE '3. Verifique os logs para confirmar que tudo está funcionando';