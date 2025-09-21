// POST /api/atos-praticados/importar-servicos
// Rota final corrigida com JOIN correto entre as tabelas

// GET /api/atos-praticados - Buscar atos praticados por data
app.get('/api/atos-praticados', authenticateToken, async (req, res) => {
  try {
    const { data } = req.query;
    
    console.log('🔍 [GET] /api/atos-praticados chamada com data:', data);
    console.log('📋 [GET] Parâmetros da query:', req.query);
    
    if (!data) {
      console.log('❌ [GET] Data não fornecida');
      return res.status(400).json({ message: 'Parâmetro data é obrigatório' });
    }

    // Garantir que a data está no formato correto (YYYY-MM-DD)
    let dataFormatada = data;
    if (data.includes('/')) {
      // Se vier no formato DD/MM/YYYY, converter para YYYY-MM-DD
      const partesData = data.split('/');
      if (partesData.length === 3) {
        dataFormatada = `${partesData[2]}-${partesData[1].padStart(2, '0')}-${partesData[0].padStart(2, '0')}`;
      }
    }
    
    console.log('📅 [GET] Data formatada para consulta:', dataFormatada);

    const query = `
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
        detalhes_pagamentos,
        usuario,
        origem_importacao,
        criado_em,
        atualizado_em
      FROM atos_praticados 
      WHERE data = $1 
      ORDER BY data DESC, hora DESC, id DESC
    `;
    
    console.log('🔍 [GET] Executando query:', query);
    console.log('🔍 [GET] Parâmetros:', [dataFormatada]);

    const result = await pool.query(query, [dataFormatada]);
    const atos = result.rows;
    
    console.log(`📊 [GET] Encontrados ${atos.length} atos na data ${dataFormatada}`);
    
    if (atos.length > 0) {
      console.log('👥 [GET] Usuários únicos nos atos:', [...new Set(atos.map(a => a.usuario))]);
      console.log('🔍 [GET] Primeiros 2 atos:', atos.slice(0, 2).map(a => ({
        id: a.id,
        codigo: a.codigo,
        descricao: a.descricao,
        usuario: a.usuario,
        origem_importacao: a.origem_importacao
      })));
    }
    
    console.log(`📤 [GET] /api/atos-praticados - retornando ${atos.length} atos`);
    res.json(atos);

  } catch (error) {
    console.error('💥 [GET] Erro ao buscar atos praticados:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor ao buscar atos praticados',
      erro: error.message 
    });
  }
});

app.post('/api/atos-praticados/importar-servicos', authenticateToken, async (req, res) => {
  try {
    const { data, usuarios, serventia } = req.body;

    console.log('🔄 Iniciando importação de atos:', { data, usuarios: usuarios?.length, serventia });
    console.log('📅 Data recebida para busca:', data, 'Tipo:', typeof data);

    if (!data || !usuarios || !Array.isArray(usuarios) || usuarios.length === 0) {
      return res.status(400).json({ 
        message: 'Parâmetros inválidos: data e lista de usuários são obrigatórios' 
      });
    }

    // Garantir que a data está no formato correto (YYYY-MM-DD)
    let dataFormatada = data;
    if (data.includes('/')) {
      // Se vier no formato DD/MM/YYYY, converter para YYYY-MM-DD
      const partesData = data.split('/');
      if (partesData.length === 3) {
        dataFormatada = `${partesData[2]}-${partesData[1].padStart(2, '0')}-${partesData[0].padStart(2, '0')}`;
      }
    }
    console.log('📅 Data formatada para consulta:', dataFormatada);

    // 1. Buscar dados da tabela selos_execucao_servico com JOIN para pedido_pagamento
    console.log('📋 Buscando atos da tabela selos_execucao_servico...');
    
    const querySelosComPagamento = `
      SELECT 
        s.id,
        s.execucao_servico_id,
        DATE(s.criado_em) as data_execucao,
        TO_CHAR(s.criado_em, 'HH24:MI:SS') as hora_execucao,
        s.selo_consulta,
        s.codigo_seguranca,
        s.qtd_atos,
        s.atos_praticados_por as usuario_execucao,
        s.valores,
        s.criado_em,
        -- Dados de pagamento da tabela pedido_pagamento
        p.id as pagamento_id,
        p.protocolo as pagamento_protocolo,
        p.valor_atos,
        p.valor_adicional,
        p.total_adiantado,
        p.usuario as pagamento_usuario,
        p.data as pagamento_data,
        p.hora as pagamento_hora,
        p.complemento_pagamento
      FROM selos_execucao_servico s
      LEFT JOIN pedido_pagamento p ON p.protocolo = s.execucao_servico_id
      WHERE DATE(s.criado_em) = $1::date
        AND (
          s.atos_praticados_por = ANY($2::text[])
          OR UPPER(s.atos_praticados_por) LIKE ANY(
            SELECT UPPER('%' || usuario_busca || '%') 
            FROM unnest($2::text[]) AS usuario_busca
          )
          OR EXISTS (
            SELECT 1 FROM unnest($2::text[]) AS usuario_busca
            WHERE UPPER(usuario_busca) LIKE UPPER('%' || split_part(s.atos_praticados_por, ' ', 1) || '%')
               OR UPPER(usuario_busca) LIKE UPPER('%' || split_part(s.atos_praticados_por, ' ', 2) || '%')
          )
        )
      ORDER BY s.criado_em DESC
    `;

    console.log('🔍 Executando consulta com parâmetros:', { dataFormatada, usuarios });
    console.log('🔍 Consulta com busca flexível de nomes de usuário');
    const resultSelos = await pool.query(querySelosComPagamento, [dataFormatada, usuarios]);
    const selosEncontrados = resultSelos.rows;

    console.log(`📊 Encontrados ${selosEncontrados.length} registros na tabela selos_execucao_servico`);
    
    // Debug: mostrar alguns registros encontrados para verificar os dados
    if (selosEncontrados.length > 0) {
      console.log('🔍 Primeiros registros encontrados:', selosEncontrados.slice(0, 2).map(selo => ({
        id: selo.id,
        execucao_servico_id: selo.execucao_servico_id,
        data_execucao: selo.data_execucao,
        usuario_execucao: selo.usuario_execucao,
        qtd_atos: selo.qtd_atos,
        criado_em: selo.criado_em
      })));
      
      // Mostrar todos os usuários únicos encontrados
      const usuariosEncontrados = [...new Set(selosEncontrados.map(s => s.usuario_execucao))];
      console.log('👥 Usuários encontrados no banco:', usuariosEncontrados);
      console.log('👥 Usuários pesquisados pelo frontend:', usuarios);
    } else {
      // Se não encontrou nada, vamos fazer uma consulta de debug
      console.log('🔍 Fazendo consulta de debug para verificar dados existentes...');
      const debugQuery = `
        SELECT 
          DATE(criado_em) as data_criacao,
          atos_praticados_por,
          COUNT(*) as total_registros
        FROM selos_execucao_servico 
        WHERE DATE(criado_em) = $1::date
        GROUP BY DATE(criado_em), atos_praticados_por
        ORDER BY atos_praticados_por
      `;
      
      try {
        const debugResult = await pool.query(debugQuery, [dataFormatada]);
        console.log('📋 Usuários com atos na data pesquisada:', debugResult.rows);
        
        if (debugResult.rows.length > 0) {
          console.log('🔍 Comparação de nomes:');
          debugResult.rows.forEach(row => {
            const usuarioBanco = row.atos_praticados_por;
            const matchExato = usuarios.includes(usuarioBanco);
            
            // Testar match parcial mais detalhado
            let matchParcial = false;
            let detalhesMatch = [];
            
            usuarios.forEach(usuarioFrontend => {
              const usuarioFrontendUpper = usuarioFrontend.toUpperCase();
              const usuarioBancoUpper = usuarioBanco.toUpperCase();
              
              // Teste 1: usuário do banco contém o do frontend
              if (usuarioBancoUpper.includes(usuarioFrontendUpper)) {
                matchParcial = true;
                detalhesMatch.push(`"${usuarioBanco}" contém "${usuarioFrontend}"`);
              }
              
              // Teste 2: usuário do frontend contém o do banco
              if (usuarioFrontendUpper.includes(usuarioBancoUpper)) {
                matchParcial = true;
                detalhesMatch.push(`"${usuarioFrontend}" contém "${usuarioBanco}"`);
              }
              
              // Teste 3: match por palavras individuais
              const palavrasBanco = usuarioBancoUpper.split(' ');
              const palavrasFrontend = usuarioFrontendUpper.split(' ');
              
              const temPalavraComum = palavrasBanco.some(pBanco => 
                palavrasFrontend.some(pFrontend => 
                  pBanco.includes(pFrontend) || pFrontend.includes(pBanco)
                )
              );
              
              if (temPalavraComum && !matchParcial) {
                matchParcial = true;
                detalhesMatch.push(`palavras em comum entre "${usuarioBanco}" e "${usuarioFrontend}"`);
              }
            });
            
            console.log(`  - DB: "${usuarioBanco}" | Match exato: ${matchExato} | Match parcial: ${matchParcial}`);
            if (detalhesMatch.length > 0) {
              console.log(`    Detalhes: ${detalhesMatch.join(', ')}`);
            }
          });
        }
      } catch (debugError) {
        console.error('❌ Erro na consulta de debug:', debugError);
      }
    }

    if (selosEncontrados.length === 0) {
      return res.json({
        message: 'Nenhum ato encontrado na tabela selos_execucao_servico para os critérios informados',
        atosEncontrados: 0,
        atosImportados: 0
      });
    }

    // 2. Verificar quais atos já existem na tabela atos_praticados
    console.log('🔍 Verificando atos já existentes...');
    
    // Como não temos execucao_servico_id na tabela atos_praticados,
    // vamos verificar por data + usuario + origem_importacao
    const queryVerificar = `
      SELECT usuario, data 
      FROM atos_praticados 
      WHERE data = $1
        AND usuario = ANY($2::text[])
        AND origem_importacao = 'selos_execucao_servico'
    `;
    
    const resultVerificar = await pool.query(queryVerificar, [dataFormatada, usuarios]);
    const usuariosComImportacao = new Set(resultVerificar.rows.map(row => row.usuario));

    console.log(`📋 ${usuariosComImportacao.size} usuários já têm atos importados para esta data`);

    // 3. Filtrar apenas os atos de usuários que ainda não importaram
    const atosNovos = selosEncontrados.filter(selo => !usuariosComImportacao.has(selo.usuario_execucao));

    console.log(`✨ ${atosNovos.length} atos novos serão importados`);

    if (atosNovos.length === 0) {
      return res.json({
        message: 'Todos os usuários já importaram atos para esta data',
        atosEncontrados: selosEncontrados.length,
        atosImportados: 0
      });
    }

    // 3.1. Criar mapeamento de usuários do banco para usuários do frontend
    const criarMapeamentoUsuarios = (usuariosBanco, usuariosFrontend) => {
      const mapeamento = {};
      
      usuariosBanco.forEach(usuarioBanco => {
        // Primeiro tentar match exato
        let usuarioCorrespondente = usuariosFrontend.find(uf => uf === usuarioBanco);
        
        if (!usuarioCorrespondente) {
          // Se não achou match exato, tentar match por primeiro e último nome
          const palavrasBanco = usuarioBanco.toUpperCase().split(' ').filter(p => p.length > 2); // Filtrar palavras muito pequenas
          
          let melhorMatch = null;
          let maiorPontuacao = 0;
          
          usuariosFrontend.forEach(usuarioFrontend => {
            const palavrasFrontend = usuarioFrontend.toUpperCase().split(' ').filter(p => p.length > 2);
            let pontuacao = 0;
            
            // Dar prioridade para primeiro e último nome
            if (palavrasBanco.length > 0 && palavrasFrontend.length > 0) {
              // Verificar primeiro nome
              const primeiroNomeBanco = palavrasBanco[0];
              const primeiroNomeFrontend = palavrasFrontend[0];
              
              if (primeiroNomeBanco.includes(primeiroNomeFrontend) || primeiroNomeFrontend.includes(primeiroNomeBanco)) {
                pontuacao += 10; // Peso alto para primeiro nome
                console.log(`  📋 Match primeiro nome: "${primeiroNomeBanco}" ↔ "${primeiroNomeFrontend}" (+10)`);
              }
              
              // Verificar último nome se existir
              if (palavrasBanco.length > 1 && palavrasFrontend.length > 1) {
                const ultimoNomeBanco = palavrasBanco[palavrasBanco.length - 1];
                const ultimoNomeFrontend = palavrasFrontend[palavrasFrontend.length - 1];
                
                if (ultimoNomeBanco.includes(ultimoNomeFrontend) || ultimoNomeFrontend.includes(ultimoNomeBanco)) {
                  pontuacao += 10; // Peso alto para último nome
                  console.log(`  📋 Match último nome: "${ultimoNomeBanco}" ↔ "${ultimoNomeFrontend}" (+10)`);
                }
              }
              
              // Verificar outras palavras (peso menor)
              palavrasBanco.forEach(pBanco => {
                palavrasFrontend.forEach(pFrontend => {
                  if (pBanco !== palavrasBanco[0] && pBanco !== palavrasBanco[palavrasBanco.length - 1]) {
                    if (pBanco.includes(pFrontend) || pFrontend.includes(pBanco)) {
                      pontuacao += 2; // Peso menor para nomes do meio
                      console.log(`  📋 Match nome do meio: "${pBanco}" ↔ "${pFrontend}" (+2)`);
                    }
                  }
                });
              });
            }
            
            console.log(`  🎯 Pontuação "${usuarioBanco}" vs "${usuarioFrontend}": ${pontuacao}`);
            
            // Se esta pontuação é melhor, guardar como melhor match
            if (pontuacao > maiorPontuacao && pontuacao >= 10) { // Exigir pelo menos primeiro ou último nome
              maiorPontuacao = pontuacao;
              melhorMatch = usuarioFrontend;
            }
          });
          
          usuarioCorrespondente = melhorMatch;
        }
        
        if (usuarioCorrespondente) {
          mapeamento[usuarioBanco] = usuarioCorrespondente;
          console.log(`🔗 Mapeamento: "${usuarioBanco}" -> "${usuarioCorrespondente}"`);
        } else {
          console.log(`⚠️ Nenhum match encontrado para: "${usuarioBanco}"`);
          mapeamento[usuarioBanco] = usuarioBanco; // fallback para o nome original
        }
      });
      
      return mapeamento;
    };

    // Criar o mapeamento de usuários
    const usuariosUnicos = [...new Set(selosEncontrados.map(s => s.usuario_execucao))];
    const mapeamentoUsuarios = criarMapeamentoUsuarios(usuariosUnicos, usuarios);
    console.log('📋 Mapeamento completo de usuários:', mapeamentoUsuarios);

    // 4. Função para extrair atos do campo qtd_atos
    const extrairAtosDoTexto = (qtdAtosTexto) => {
      const atos = [];
      if (!qtdAtosTexto) return atos;

      // Regex para capturar padrões como "1(7802)" ou "2(1234)"
      const regex = /(\d+)\((\d+)\)/g;
      let match;

      while ((match = regex.exec(qtdAtosTexto)) !== null) {
        const quantidade = parseInt(match[1]);
        const codigo = match[2];
        
        atos.push({
          codigo: codigo,
          quantidade: quantidade
        });
      }

      console.log(`📋 Extraídos ${atos.length} atos do texto: "${qtdAtosTexto}"`, atos);
      return atos;
    };

    // 5. Função para extrair formas de pagamento do JSONB
    const extrairFormasPagamento = (complementoPagamento) => {
      const pagamentos = {
        dinheiro: { quantidade: 0, valor: 0, manual: false },
        cartao: { quantidade: 0, valor: 0, manual: false },
        pix: { quantidade: 0, valor: 0, manual: false },
        crc: { quantidade: 0, valor: 0, manual: false },
        depositoPrevio: { quantidade: 0, valor: 0, manual: false }
      };

      if (!complementoPagamento) {
        console.log('⚠️ Sem dados de complemento_pagamento');
        return pagamentos;
      }

      try {
        // Se já é um objeto, usar diretamente; se é string, fazer parse
        const dadosPagamento = typeof complementoPagamento === 'string' 
          ? JSON.parse(complementoPagamento) 
          : complementoPagamento;

        console.log('💳 Dados de pagamento extraídos:', dadosPagamento);

        // Mapear os dados conforme a estrutura encontrada
        Object.keys(dadosPagamento).forEach(chave => {
          const valor = dadosPagamento[chave];
          
          // Mapear para as chaves esperadas pelo frontend
          const mapeamento = {
            'dinheiro': 'dinheiro',
            'cartao': 'cartao',
            'cartão': 'cartao',
            'pix': 'pix',
            'crc': 'crc',
            'deposito_previo': 'depositoPrevio',
            'depositoPrevio': 'depositoPrevio'
          };

          const chaveCorreta = mapeamento[chave.toLowerCase()];
          if (chaveCorreta && typeof valor === 'object' && valor !== null) {
            pagamentos[chaveCorreta] = {
              quantidade: parseInt(valor.quantidade) || 0,
              valor: parseFloat(valor.valor) || 0,
              manual: Boolean(valor.manual)
            };
          }
        });

      } catch (error) {
        console.error('❌ Erro ao processar complemento_pagamento:', error);
      }

      return pagamentos;
    };

    // 6. Inserir os atos novos na tabela atos_praticados
    console.log('💾 Inserindo novos atos na tabela atos_praticados...');
    
    let atosInseridos = 0;
    const queryInserir = `
      INSERT INTO atos_praticados (
        data, hora, codigo, descricao, quantidade, valor_unitario, 
        pagamentos, usuario, origem_importacao
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    for (const selo of atosNovos) {
      try {
        // Extrair formas de pagamento
        const formasPagamento = extrairFormasPagamento(selo.complemento_pagamento);

        // Extrair atos do campo qtd_atos
        const atosExtraidos = extrairAtosDoTexto(selo.qtd_atos);

        if (atosExtraidos.length === 0) {
          console.log(`⚠️ Nenhum ato válido encontrado em: "${selo.qtd_atos}"`);
          continue;
        }

        // Inserir um registro para cada ato extraído
        for (const ato of atosExtraidos) {
          // Usar o nome do usuário mapeado do frontend ao invés do nome do banco
          const usuarioFrontend = mapeamentoUsuarios[selo.usuario_execucao] || selo.usuario_execucao;
          
          console.log(`📝 Inserindo ato ${selo.execucao_servico_id} - Código: ${ato.codigo}, Quantidade: ${ato.quantidade}:`, {
            codigo: ato.codigo,
            descricao: `Ato ${ato.codigo} importado do sistema de selos`,
            valor_unitario: selo.valor_atos || 0,
            quantidade: ato.quantidade,
            usuario_banco: selo.usuario_execucao,
            usuario_frontend: usuarioFrontend,
            formasPagamento: formasPagamento
          });

          await pool.query(queryInserir, [
            selo.data_execucao, // Já extraído como DATE(s.criado_em)
            selo.hora_execucao || '00:00:00', // Já extraído como TO_CHAR(s.criado_em, 'HH24:MI:SS')
            ato.codigo, // Código extraído do campo qtd_atos
            `Ato ${ato.codigo} importado do sistema de selos`, // Descrição com o código
            ato.quantidade, // Quantidade extraída do campo qtd_atos
            parseFloat(selo.valor_atos) || 0, // Usar valor_atos da tabela pedido_pagamento
            JSON.stringify(formasPagamento),
            usuarioFrontend, // USAR O NOME DO FRONTEND, NÃO O DO BANCO
            'selos_execucao_servico' // origem da importação
          ]);

          atosInseridos++;
          console.log(`✅ Ato ${selo.execucao_servico_id} - ${ato.codigo} (${ato.quantidade}x) inserido com sucesso para usuário: "${usuarioFrontend}"`);
        }

      } catch (error) {
        console.error(`❌ Erro ao inserir ato ${selo.execucao_servico_id}:`, error);
        // Continua com os próximos atos mesmo se um falhar
      }
    }

    console.log(`🎉 Importação concluída: ${atosInseridos} atos inseridos de ${atosNovos.length} tentativas`);

    res.json({
      message: `Importação concluída com sucesso! ${atosInseridos} atos foram importados.`,
      atosEncontrados: selosEncontrados.length,
      atosImportados: atosInseridos,
      detalhes: {
        usuariosComImportacaoPrevia: usuariosComImportacao.size,
        atosNovosEncontrados: atosNovos.length,
        atosInseridosComSucesso: atosInseridos
      }
    });

  } catch (error) {
    console.error('💥 Erro na importação de atos:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor ao importar atos',
      erro: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});