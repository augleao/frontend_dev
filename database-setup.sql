-- SQL PARA IMPLEMENTAR A FUNCIONALIDADE DE IMPORTAÇÃO DE ATOS PRATICADOS
-- Execute estes comandos no banco de dados PostgreSQL

-- 1. Adicionar colunas na tabela atos_praticados para rastreamento da importação (opcionais)
ALTER TABLE atos_praticados ADD COLUMN IF NOT EXISTS origem_importacao VARCHAR(50) DEFAULT NULL;
ALTER TABLE atos_praticados ADD COLUMN IF NOT EXISTS selo_inicial VARCHAR(20) DEFAULT NULL;
ALTER TABLE atos_praticados ADD COLUMN IF NOT EXISTS selo_final VARCHAR(20) DEFAULT NULL;

-- 2. Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_atos_praticados_importacao 
ON atos_praticados(data, usuario, codigo, origem_importacao);

CREATE INDEX IF NOT EXISTS idx_selos_execucao_data_usuario 
ON selos_execucao_servico(data_execucao, usuario);

-- 3. Verificar estrutura das tabelas necessárias
-- Esta consulta mostra as colunas disponíveis na tabela selos_execucao_servico
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'selos_execucao_servico' 
ORDER BY ordinal_position;

-- Esta consulta mostra as colunas disponíveis na tabela servico_pagamento
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'servico_pagamento' 
ORDER BY ordinal_position;

-- 4. Consulta de exemplo para verificar dados disponíveis com pagamentos
-- Execute para ver uma amostra dos dados que serão importados
SELECT 
    s.usuario,
    s.codigo_tributo,
    s.descricao,
    s.qtd_atos,
    s.data_execucao,
    s.selo_inicial,
    s.selo_final,
    s.pedido_id,
    sp.forma_pagamento,
    sp.valor_total
FROM selos_execucao_servico s
LEFT JOIN servico_pagamento sp ON s.pedido_id = sp.pedido_id
WHERE s.data_execucao = CURRENT_DATE 
    AND s.qtd_atos > 0
LIMIT 10;

-- 5. Verificar configuração de caixa unificado das serventias
SELECT nome_serventia, caixa_unificado 
FROM serventia_config 
WHERE caixa_unificado = true;

-- 6. Consulta para verificar atos já importados (após implementação)
SELECT 
    data,
    usuario,
    codigo,
    descricao,
    quantidade,
    origem_importacao,
    selo_inicial,
    selo_final
FROM atos_praticados 
WHERE origem_importacao = 'selos_execucao_servico'
    AND data = CURRENT_DATE
ORDER BY usuario, codigo;