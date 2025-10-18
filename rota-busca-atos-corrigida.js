// Rota corrigida para busca de atos praticados
app.get('/api/busca-atos/pesquisa', authenticateToken, async (req, res) => {
  try {
    const { 
      dataInicial, 
      dataFinal, 
      usuario, 
      codigo, 
      tributacao 
    } = req.query;

    console.log('🔍 [Busca Atos] Parâmetros recebidos:', req.query);

    // Validação básica - pelo menos um filtro deve ser fornecido
    if (!dataInicial && !dataFinal && !usuario && !codigo && !tributacao) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, forneça pelo menos um filtro de busca.'
      });
    }

    // Construir query SQL dinamicamente com todas as colunas disponíveis
    let sqlQuery = `
      SELECT 
        id,
        data,
        hora,
        codigo,
        tributacao,
        descricao,
        quantidade,
        valor_unitario,
        pagamentos,
        usuario,
        detalhes_pagamentos,
        selo_final,
        origem_importacao,
        selo_inicial
      FROM atos_praticados 
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    // Filtro por período de datas
    if (dataInicial) {
      sqlQuery += ` AND data >= $${paramIndex}`;
      params.push(dataInicial);
      paramIndex++;
    }

    if (dataFinal) {
      sqlQuery += ` AND data <= $${paramIndex}`;
      params.push(dataFinal);
      paramIndex++;
    }

    // Filtro por usuário (nome do escrevente) - busca parcial
    if (usuario && usuario.trim()) {
      sqlQuery += ` AND UPPER(usuario) LIKE UPPER($${paramIndex})`;
      params.push(`%${usuario.trim()}%`);
      paramIndex++;
    }

    // Filtro por código do ato - busca exata
    if (codigo && codigo.trim()) {
      sqlQuery += ` AND codigo = $${paramIndex}`;
      params.push(codigo.trim());
      paramIndex++;
    }

    // Filtro por tributação - busca exata
    if (tributacao && tributacao.trim()) {
      sqlQuery += ` AND tributacao = $${paramIndex}`;
      params.push(tributacao.trim());
      paramIndex++;
    }

    // Ordenar por data e hora mais recentes
    sqlQuery += ` ORDER BY data DESC, hora DESC`;

    console.log('📊 [Busca Atos] Query SQL:', sqlQuery);
    console.log('📊 [Busca Atos] Parâmetros:', params);

    // Executar query
    const result = await pool.query(sqlQuery, params);
    const atos = result.rows;

    console.log('✅ [Busca Atos] Atos encontrados:', atos.length);

    // Processar dados dos atos para garantir formato correto
    const atosProcessados = atos.map(ato => ({
      ...ato,
      // Garantir que pagamentos seja um objeto
      pagamentos: typeof ato.pagamentos === 'string' 
        ? JSON.parse(ato.pagamentos || '{}') 
        : (ato.pagamentos || {}),
      // Garantir que detalhes_pagamentos seja um objeto
      detalhes_pagamentos: typeof ato.detalhes_pagamentos === 'string'
        ? JSON.parse(ato.detalhes_pagamentos || '{}')
        : (ato.detalhes_pagamentos || {}),
      // Garantir formato numérico
      quantidade: Number(ato.quantidade || 0),
      valor_unitario: Number(ato.valor_unitario || 0),
      // Adicionar tributacao_descricao vazio (para compatibilidade com frontend)
      tributacao_descricao: '',
      // Garantir que campos opcionais existam
      selo_final: ato.selo_final || null,
      origem_importacao: ato.origem_importacao || null,
      selo_inicial: ato.selo_inicial || null
    }));

    res.json({
      success: true,
      atos: atosProcessados,
      total: atosProcessados.length,
      filtros: {
        dataInicial,
        dataFinal,
        usuario,
        codigo,
        tributacao
      }
    });

  } catch (error) {
    console.error('❌ [Busca Atos] Erro na pesquisa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao buscar atos.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno'
    });
  }
});