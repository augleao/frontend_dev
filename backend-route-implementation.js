/**
 * IMPLEMENTAÇÃO DA ROTA PARA IMPORTAR ATOS PRATICADOS
 * 
 * Esta rota deve ser adicionada ao arquivo server.js do backend
 * URL: POST /api/atos-praticados/importar
 */

// Rota para importar atos praticados da tabela selos_execucao_servico
// POST /api/atos-praticados/importar-servicos
app.post('/api/atos-praticados/importar-servicos', authenticate, async (req, res) => {
  try {
    const { data, usuarios, serventia } = req.body;

    if (!data || !usuarios || !serventia) {
      return res.status(400).json({ 
        message: 'Parâmetros obrigatórios: data, usuarios, serventia' 
      });
    }

    // 1. Buscar registros na tabela selos_execucao_servico com informações de pagamento
    const selosQuery = `
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
      WHERE s.data_execucao = $1 
        AND s.usuario = ANY($2)
        AND s.qtd_atos > 0
      ORDER BY s.usuario, s.codigo_tributo
    `;

    const selosResult = await pool.query(selosQuery, [data, usuarios]);
    const selosEncontrados = selosResult.rows;

    if (selosEncontrados.length === 0) {
      return res.json({ 
        message: 'Nenhum ato encontrado para importar na data selecionada',
        atosImportados: 0 
      });
    }

    // 2. Preparar dados para inserção na tabela atos_praticados
    let atosImportados = 0;
    const atosParaInserir = [];

    for (const selo of selosEncontrados) {
      // Verificar se já existe um ato praticado para este registro
      const existeAtoQuery = `
        SELECT id FROM atos_praticados 
        WHERE data = $1 
          AND usuario = $2 
          AND codigo = $3
          AND origem_importacao = 'selos_execucao_servico'
      `;
      
      const existeAto = await pool.query(existeAtoQuery, [
        data, 
        selo.usuario, 
        selo.codigo_tributo
      ]);

      if (existeAto.rows.length === 0) {
        // Não existe, pode inserir
        // Preparar objeto de pagamentos baseado na forma de pagamento do serviço
        let pagamentosObj = {};
        if (selo.forma_pagamento && selo.valor_total) {
          // Mapear forma de pagamento do serviço para o formato esperado
          const formaPagamentoMap = {
            'dinheiro': 'dinheiro',
            'cartao': 'cartao', 
            'cartão': 'cartao',
            'pix': 'pix',
            'crc': 'crc',
            'deposito_previo': 'depositoPrevio',
            'deposito previo': 'depositoPrevio'
          };
          
          const formaKey = formaPagamentoMap[selo.forma_pagamento.toLowerCase()];
          if (formaKey) {
            pagamentosObj[formaKey] = {
              quantidade: selo.qtd_atos,
              valor: parseFloat(selo.valor_total) || 0,
              manual: false
            };
          }
        }

        const atoParaInserir = {
          data: data,
          hora: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
          codigo: selo.codigo_tributo || '',
          descricao: selo.descricao || '',
          quantidade: selo.qtd_atos,
          valor_unitario: selo.valor_total ? (parseFloat(selo.valor_total) / selo.qtd_atos) : 0,
          pagamentos: JSON.stringify(pagamentosObj),
          usuario: selo.usuario,
          origem_importacao: 'selos_execucao_servico',
          selo_inicial: selo.selo_inicial || null,
          selo_final: selo.selo_final || null
        };
        
        atosParaInserir.push(atoParaInserir);
      }
    }

    // 3. Inserir atos na tabela atos_praticados
    if (atosParaInserir.length > 0) {
      const insertQuery = `
        INSERT INTO atos_praticados (
          data, hora, codigo, descricao, quantidade, valor_unitario, 
          pagamentos, usuario, origem_importacao, selo_inicial, selo_final
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `;

      for (const ato of atosParaInserir) {
        try {
          await pool.query(insertQuery, [
            ato.data,
            ato.hora,
            ato.codigo,
            ato.descricao,
            ato.quantidade,
            ato.valor_unitario,
            ato.pagamentos,
            ato.usuario,
            ato.origem_importacao,
            ato.selo_inicial,
            ato.selo_final
          ]);
          atosImportados++;
          console.log(`✅ Ato importado: ${ato.usuario} - ${ato.codigo} - ${ato.descricao}`);
        } catch (insertError) {
          console.error('❌ Erro ao inserir ato:', insertError.message, ato);
          // Continue tentando inserir os outros atos
        }
      }
    }

    // 4. Log da importação
    console.log(`[IMPORTAÇÃO ATOS] Serventia: ${serventia}, Data: ${data}, Atos importados: ${atosImportados}/${selosEncontrados.length}`);

    res.json({
      message: `Importação concluída com sucesso!`,
      atosImportados: atosImportados,
      atosEncontrados: selosEncontrados.length,
      serventia: serventia,
      data: data
    });

  } catch (error) {
    console.error('Erro ao importar atos praticados:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor ao importar atos',
      error: error.message 
    });
  }
});

/**
 * ALTERAÇÕES NECESSÁRIAS NA TABELA atos_praticados
 * 
 * Caso a tabela não tenha estas colunas, execute os comandos SQL abaixo:
 */

/*
-- Adicionar colunas para rastreamento da importação
ALTER TABLE atos_praticados ADD COLUMN IF NOT EXISTS origem_importacao VARCHAR(50);
ALTER TABLE atos_praticados ADD COLUMN IF NOT EXISTS selo_inicial VARCHAR(20);
ALTER TABLE atos_praticados ADD COLUMN IF NOT EXISTS selo_final VARCHAR(20);

-- Criar índice para melhorar performance das consultas de verificação
CREATE INDEX IF NOT EXISTS idx_atos_praticados_importacao 
ON atos_praticados(data, usuario, codigo, origem_importacao);
*/

/**
 * NOTAS DE IMPLEMENTAÇÃO:
 * 
 * 1. A rota verifica se já existem atos importados para evitar duplicatas
 * 2. Adiciona uma coluna 'origem_importacao' para identificar atos importados
 * 3. Preserva informações dos selos (inicial/final) para rastreabilidade
 * 4. Inicializa valores e pagamentos em branco para preenchimento posterior
 * 5. Retorna estatísticas da importação (quantos atos foram importados)
 * 
 * DEPENDÊNCIAS:
 * - Middleware authenticateToken deve estar configurado
 * - Pool de conexão PostgreSQL deve estar disponível
 * - Tabela selos_execucao_servico deve existir com as colunas mencionadas
 */