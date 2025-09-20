// Rota para importar atos da tabela selos_execucao_servico para atos_praticados
// Adicione esta rota ao seu backend Express.js

const express = require('express');
const router = express.Router();

// POST /api/atos-praticados/importar-servicos
router.post('/importar-servicos', async (req, res) => {
  try {
    const { data, usuarios, serventia } = req.body;
    
    // Validação dos parâmetros
    if (!data) {
      return res.status(400).json({ message: 'Data é obrigatória' });
    }
    
    if (!usuarios || !Array.isArray(usuarios) || usuarios.length === 0) {
      return res.status(400).json({ message: 'Lista de usuários é obrigatória' });
    }
    
    if (!serventia) {
      return res.status(400).json({ message: 'Serventia é obrigatória' });
    }

    // Buscar registros da tabela selos_execucao_servico para a data especificada
    // que ainda não foram importados para atos_praticados
    const queryBuscarSelos = `
      SELECT DISTINCT
        s.id,
        s.data_execucao,
        s.hora_execucao,
        s.codigo,
        s.quantidade,
        s.valor_unitario,
        s.usuario,
        s.forma_pagamento,
        a.descricao
      FROM selos_execucao_servico s
      LEFT JOIN atos a ON s.codigo = a.codigo
      WHERE s.data_execucao = $1
        AND s.usuario = ANY($2)
        AND NOT EXISTS (
          SELECT 1 FROM atos_praticados ap 
          WHERE ap.data = s.data_execucao 
            AND ap.codigo = s.codigo 
            AND ap.usuario = s.usuario
            AND ap.origem_importacao = 'selos_execucao_servico'
        )
      ORDER BY s.hora_execucao, s.id
    `;

    const resultSelos = await req.db.query(queryBuscarSelos, [data, usuarios]);
    const selosParaImportar = resultSelos.rows;

    if (selosParaImportar.length === 0) {
      return res.json({
        message: 'Nenhum ato novo encontrado para importar',
        atosEncontrados: 0,
        atosImportados: 0
      });
    }

    let atosImportados = 0;
    const atosProcessados = [];

    // Mapear formas de pagamento
    const mapeamentoFormasPagamento = {
      'dinheiro': 'dinheiro',
      'cartao': 'cartao',
      'pix': 'pix',
      'crc': 'crc',
      'deposito_previo': 'depositoPrevio'
    };

    for (const selo of selosParaImportar) {
      try {
        // Preparar dados do ato
        const atoData = {
          data: selo.data_execucao,
          hora: selo.hora_execucao || new Date().toLocaleTimeString("pt-BR", { hour12: false }),
          codigo: selo.codigo,
          descricao: selo.descricao || `Ato código ${selo.codigo}`,
          quantidade: selo.quantidade || 1,
          valor_unitario: parseFloat(selo.valor_unitario) || 0,
          usuario: selo.usuario,
          origem_importacao: 'selos_execucao_servico',
          selo_inicial: selo.id,
          selo_final: selo.id
        };

        // Preparar formas de pagamento
        const formaPagamento = mapeamentoFormasPagamento[selo.forma_pagamento] || 'dinheiro';
        const valorTotal = (parseFloat(selo.valor_unitario) || 0) * (selo.quantidade || 1);
        
        const pagamentos = {
          dinheiro: { quantidade: 0, valor: 0 },
          cartao: { quantidade: 0, valor: 0 },
          pix: { quantidade: 0, valor: 0 },
          crc: { quantidade: 0, valor: 0 },
          depositoPrevio: { quantidade: 0, valor: 0 }
        };
        
        // Definir o pagamento correto
        pagamentos[formaPagamento] = {
          quantidade: selo.quantidade || 1,
          valor: valorTotal
        };

        atoData.pagamentos = pagamentos;

        // Inserir no banco de dados
        const queryInserir = `
          INSERT INTO atos_praticados (
            data, hora, codigo, descricao, quantidade, valor_unitario, 
            pagamentos, usuario, origem_importacao, selo_inicial, selo_final
          ) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id
        `;

        const resultInserir = await req.db.query(queryInserir, [
          atoData.data,
          atoData.hora,
          atoData.codigo,
          atoData.descricao,
          atoData.quantidade,
          atoData.valor_unitario,
          JSON.stringify(atoData.pagamentos),
          atoData.usuario,
          atoData.origem_importacao,
          atoData.selo_inicial,
          atoData.selo_final
        ]);

        if (resultInserir.rows.length > 0) {
          atosImportados++;
          atosProcessados.push({
            id: resultInserir.rows[0].id,
            codigo: atoData.codigo,
            descricao: atoData.descricao,
            usuario: atoData.usuario,
            valor: valorTotal
          });
        }

      } catch (errorAto) {
        console.error('Erro ao importar ato individual:', errorAto);
        // Continuar com o próximo ato mesmo se houver erro
      }
    }

    console.log(`Importação concluída: ${atosImportados}/${selosParaImportar.length} atos importados`);

    res.json({
      message: `Importação concluída com sucesso`,
      atosEncontrados: selosParaImportar.length,
      atosImportados: atosImportados,
      atos: atosProcessados
    });

  } catch (error) {
    console.error('Erro ao importar atos dos serviços:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor ao importar atos',
      error: error.message 
    });
  }
});

module.exports = router;

// INSTRUÇÕES DE USO:
// 1. Adicione este arquivo ao seu backend
// 2. No seu arquivo principal (app.js ou server.js), importe e use esta rota:
//    const importarServicosRoute = require('./routes/importar-servicos');
//    app.use('/api/atos-praticados', importarServicosRoute);
//
// 3. Certifique-se de que as seguintes colunas existam na tabela atos_praticados:
//    - origem_importacao VARCHAR(255) DEFAULT NULL
//    - selo_inicial INTEGER DEFAULT NULL  
//    - selo_final INTEGER DEFAULT NULL
//
// 4. Para adicionar essas colunas, execute no PostgreSQL:
//    ALTER TABLE atos_praticados ADD COLUMN IF NOT EXISTS origem_importacao VARCHAR(255) DEFAULT NULL;
//    ALTER TABLE atos_praticados ADD COLUMN IF NOT EXISTS selo_inicial INTEGER DEFAULT NULL;
//    ALTER TABLE atos_praticados ADD COLUMN IF NOT EXISTS selo_final INTEGER DEFAULT NULL;