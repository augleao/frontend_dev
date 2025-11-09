// Backend routes for DAP (Express + pg)
// Usage: const initDapRoutes = require('./routes/dap'); initDapRoutes(app, pool, { ensureAuth, parseDapPdf });

const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeMonetary(value) {
  if (value === null || value === undefined || value === '') return 0;
  const normalized = String(value).replace(',', '.');
  return toNumber(normalized, 0);
}

async function withTransaction(pool, handler) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function normalizeHeader(raw = {}) {
  const header = {
    mes_referencia: toNumber(raw.mesReferencia ?? raw.mes_referencia),
    ano_referencia: toNumber(raw.anoReferencia ?? raw.ano_referencia),
    retificadora: !!(raw.retificadora ?? raw.retificadora === 'true'),
    retificadora_de_id: raw.retificadoraDeId ?? raw.retificadora_de_id ?? null,
    serventia_nome: raw.serventiaNome ?? raw.serventia_nome ?? null,
    codigo_serventia: raw.codigoServentia ?? raw.codigo_serventia ?? null,
    cnpj: raw.cnpj ?? null,
    data_transmissao: raw.dataTransmissao ?? raw.data_transmissao ?? null,
    codigo_recibo: raw.codigoRecibo ?? raw.codigo_recibo ?? null,
    observacoes: raw.observacoes ?? null,
    emolumento_apurado: sanitizeMonetary(raw.emolumentoApurado ?? raw.emolumento_apurado),
    taxa_fiscalizacao_judiciaria_apurada: sanitizeMonetary(raw.taxaFiscalizacaoJudiciariaApurada ?? raw.taxa_fiscalizacao_judiciaria_apurada),
    taxa_fiscalizacao_judiciaria_paga: sanitizeMonetary(raw.taxaFiscalizacaoJudiciariaPaga ?? raw.taxa_fiscalizacao_judiciaria_paga),
    recompe_apurado: sanitizeMonetary(raw.recompeApurado ?? raw.recompe_apurado),
    recompe_depositado: sanitizeMonetary(raw.recompeDepositado ?? raw.recompe_depositado),
    data_deposito_recompe: raw.dataDepositoRecompe ?? raw.data_deposito_recompe ?? null,
    valores_recebidos_recompe: sanitizeMonetary(raw.valoresRecebidosRecompe ?? raw.valores_recebidos_recompe),
    valores_recebidos_ferrfis: sanitizeMonetary(raw.valoresRecebidosFerrfis ?? raw.valores_recebidos_ferrfis),
    issqn_recebido_usuarios: sanitizeMonetary(raw.issqnRecebidoUsuarios ?? raw.issqn_recebido_usuarios),
    repasses_responsaveis_anteriores: sanitizeMonetary(raw.repassesResponsaveisAnteriores ?? raw.repasses_responsaveis_anteriores),
    saldo_deposito_previo: sanitizeMonetary(raw.saldoDepositoPrevio ?? raw.saldo_deposito_previo),
    total_despesas_mes: sanitizeMonetary(raw.totalDespesasMes ?? raw.total_despesas_mes),
    estoque_selos_eletronicos_transmissao: toNumber(raw.estoqueSelosEletronicosTransmissao ?? raw.estoque_selos_eletronicos_transmissao, 0),
  };

  if (!header.mes_referencia || !header.ano_referencia) {
    throw new Error('mesReferencia e anoReferencia são obrigatórios.');
  }
  if (!header.serventia_nome || !header.codigo_serventia) {
    throw new Error('serventiaNome e codigoServentia são obrigatórios.');
  }

  return header;
}

function normalizePeriodos(rawPeriodos = []) {
  const byOrder = new Map();
  rawPeriodos.forEach((item) => {
    const ordem = toNumber(item.ordem ?? item.periodo ?? item.ordem_periodo);
    if (!ordem || ordem < 1 || ordem > 4) return;
    const atos = Array.isArray(item.atos) ? item.atos : [];
    const normalizedAtos = atos.map((ato) => ({
      codigo: String(ato.codigo ?? '').padStart(4, '0'),
      tributacao: String(ato.tributacao ?? ato.trib ?? '').padStart(1, '0'),
      quantidade: toNumber(ato.quantidade ?? ato.qtde, 0),
      tfj_valor: sanitizeMonetary(ato.tfjValor ?? ato.tfj_valor ?? ato.tfj),
    })).filter((ato) => ato.codigo && ato.tributacao && ato.quantidade >= 0);

    const quantidadeTotal = normalizedAtos.reduce((sum, ato) => sum + (ato.quantidade || 0), 0);
    const tfjTotal = normalizedAtos.reduce((sum, ato) => sum + (ato.tfj_valor || 0), 0);

    byOrder.set(ordem, {
      ordem,
      quantidade_total: quantidadeTotal,
      tfj_total: tfjTotal,
      atos: normalizedAtos,
    });
  });

  for (let ordem = 1; ordem <= 4; ordem += 1) {
    if (!byOrder.has(ordem)) {
      byOrder.set(ordem, {
        ordem,
        quantidade_total: 0,
        tfj_total: 0,
        atos: [],
      });
    }
  }

  return Array.from(byOrder.values()).sort((a, b) => a.ordem - b.ordem);
}

async function persistDap(client, payload) {
  const header = normalizeHeader(payload.header ?? payload);
  if (payload.retificadora === true || payload.retificadora === 'true') {
    header.retificadora = true;
  }
  if (payload.retificadoraDeId) {
    header.retificadora_de_id = payload.retificadoraDeId;
  }

  const insertColumns = [
    'mes_referencia', 'ano_referencia', 'retificadora', 'retificadora_de_id',
    'serventia_nome', 'codigo_serventia', 'cnpj', 'data_transmissao', 'codigo_recibo', 'observacoes',
    'emolumento_apurado', 'taxa_fiscalizacao_judiciaria_apurada', 'taxa_fiscalizacao_judiciaria_paga',
    'recompe_apurado', 'recompe_depositado', 'data_deposito_recompe',
    'valores_recebidos_recompe', 'valores_recebidos_ferrfis', 'issqn_recebido_usuarios',
    'repasses_responsaveis_anteriores', 'saldo_deposito_previo', 'total_despesas_mes',
    'estoque_selos_eletronicos_transmissao'
  ];

  const insertValues = insertColumns.map((col) => header[col] ?? null);
  const placeholders = insertColumns.map((_, index) => `$${index + 1}`);

  const dapResult = await client.query(
    `INSERT INTO public.dap (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
    insertValues,
  );
  const dapId = dapResult.rows[0].id;

  if (header.retificadora_de_id) {
    await client.query('UPDATE public.dap SET retificada_por_id = $1 WHERE id = $2', [dapId, header.retificadora_de_id]);
  }

  const periodos = normalizePeriodos(payload.periodos || payload.periodosDap || []);
  const periodoIdMap = new Map();

  for (const periodo of periodos) {
    const periodoInsert = await client.query(
      'INSERT INTO public.dap_periodo (dap_id, ordem, quantidade_total, tfj_total) VALUES ($1, $2, $3, $4) RETURNING id',
      [dapId, periodo.ordem, periodo.quantidade_total, periodo.tfj_total],
    );
    const periodoId = periodoInsert.rows[0].id;
    periodoIdMap.set(periodo.ordem, periodoId);

    for (const ato of periodo.atos) {
      await client.query(
        `INSERT INTO public.dap_periodo_ato_snapshot
         (periodo_id, codigo, tributacao, quantidade, tfj_valor)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (periodo_id, codigo, tributacao)
         DO UPDATE SET quantidade = EXCLUDED.quantidade, tfj_valor = EXCLUDED.tfj_valor`,
        [periodoId, ato.codigo, ato.tributacao, ato.quantidade, ato.tfj_valor],
      );
    }
  }

  return { dapId, periodos: Array.from(periodoIdMap.entries()).map(([ordem, id]) => ({ ordem, id })) };
}

function buildListWhere(params, filters) {
  if (filters.codigoServentia) {
    params.push(filters.codigoServentia);
    return 'WHERE codigo_serventia = $' + params.length;
  }
  return '';
}

function extractFilters(query = {}) {
  const filters = {};
  if (query.codigoServentia) filters.codigoServentia = String(query.codigoServentia);
  if (query.ano) filters.ano = toNumber(query.ano);
  if (query.mes) filters.mes = toNumber(query.mes);
  if (query.retificadora !== undefined) filters.retificadora = query.retificadora === 'true' || query.retificadora === true;
  if (query.retificadoraDeId) filters.retificadoraDeId = query.retificadoraDeId;
  return filters;
}

function applyFiltersSQL(filters, params) {
  const clauses = [];
  if (filters.codigoServentia) {
    params.push(filters.codigoServentia);
    clauses.push(`codigo_serventia = $${params.length}`);
  }
  if (filters.ano) {
    params.push(filters.ano);
    clauses.push(`ano_referencia = $${params.length}`);
  }
  if (filters.mes) {
    params.push(filters.mes);
    clauses.push(`mes_referencia = $${params.length}`);
  }
  if (filters.retificadora !== undefined) {
    params.push(filters.retificadora);
    clauses.push(`retificadora = $${params.length}`);
  }
  if (filters.retificadoraDeId) {
    params.push(filters.retificadoraDeId);
    clauses.push(`retificadora_de_id = $${params.length}`);
  }
  return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
}

module.exports = function initDapRoutes(app, pool, options = {}) {
  const ensureAuth = options.ensureAuth || ((req, res, next) => next());
  const parseDapPdf = options.parseDapPdf;
  const uploadMiddleware = upload.single('file');

  app.post('/api/dap/upload', ensureAuth, uploadMiddleware, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Arquivo da DAP é obrigatório.' });
      }
      if (!parseDapPdf) {
        return res.status(501).json({ error: 'Parser de DAP não configurado.' });
      }
      const metadata = req.body && req.body.metadata ? JSON.parse(req.body.metadata) : {};
      const parsed = await parseDapPdf({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        metadata,
      });
      const result = await withTransaction(pool, (client) => persistDap(client, parsed));
      return res.status(201).json({ id: result.dapId, status: 'processed' });
    } catch (error) {
      console.error('Erro no upload de DAP:', error);
      return res.status(500).json({ error: 'Erro ao processar DAP.' });
    }
  });

  app.post('/api/dap', ensureAuth, async (req, res) => {
    try {
      const payload = req.body || {};
      const result = await withTransaction(pool, (client) => persistDap(client, payload));
      return res.status(201).json({ id: result.dapId });
    } catch (error) {
      console.error('Erro ao criar DAP:', error);
      return res.status(500).json({ error: error.message || 'Erro ao criar DAP.' });
    }
  });

  app.get('/api/dap', ensureAuth, async (req, res) => {
    try {
      const filters = extractFilters(req.query);
      const params = [];
      const where = applyFiltersSQL(filters, params);
      const sql = `
        SELECT id, mes_referencia AS "mesReferencia", ano_referencia AS "anoReferencia",
               retificadora, retificadora_de_id AS "retificadoraDeId", retificada_por_id AS "retificadaPorId",
               codigo_serventia AS "codigoServentia", serventia_nome AS "serventiaNome",
               data_transmissao AS "dataTransmissao", codigo_recibo AS "codigoRecibo"
        FROM public.dap
        ${where}
        ORDER BY ano_referencia DESC, mes_referencia DESC, codigo_serventia ASC
        LIMIT 200
      `;
      const { rows } = await pool.query(sql, params);
      return res.json(rows);
    } catch (error) {
      console.error('Erro ao listar DAPs:', error);
      return res.status(500).json({ error: 'Erro ao listar DAPs.' });
    }
  });

  app.get('/api/dap/:id', ensureAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'ID inválido.' });
      }
      const headerSql = `
        SELECT id, mes_referencia AS "mesReferencia", ano_referencia AS "anoReferencia",
               retificadora, retificadora_de_id AS "retificadoraDeId", retificada_por_id AS "retificadaPorId",
               serventia_nome AS "serventiaNome", codigo_serventia AS "codigoServentia", cnpj,
               data_transmissao AS "dataTransmissao", codigo_recibo AS "codigoRecibo", observacoes,
               emolumento_apurado AS "emolumentoApurado",
               taxa_fiscalizacao_judiciaria_apurada AS "taxaFiscalizacaoJudiciariaApurada",
               taxa_fiscalizacao_judiciaria_paga AS "taxaFiscalizacaoJudiciariaPaga",
               recompe_apurado AS "recompeApurado",
               recompe_depositado AS "recompeDepositado",
               data_deposito_recompe AS "dataDepositoRecompe",
               valores_recebidos_recompe AS "valoresRecebidosRecompe",
               valores_recebidos_ferrfis AS "valoresRecebidosFerrfis",
               issqn_recebido_usuarios AS "issqnRecebidoUsuarios",
               repasses_responsaveis_anteriores AS "repassesResponsaveisAnteriores",
               saldo_deposito_previo AS "saldoDepositoPrevio",
               total_despesas_mes AS "totalDespesasMes",
               estoque_selos_eletronicos_transmissao AS "estoqueSelosEletronicosTransmissao"
        FROM public.dap
        WHERE id = $1
      `;
      const headerResult = await pool.query(headerSql, [id]);
      if (!headerResult.rowCount) {
        return res.status(404).json({ error: 'DAP não encontrada.' });
      }

      const periodosSql = `
        SELECT id, ordem, quantidade_total AS "quantidadeTotal", tfj_total AS "tfjTotal"
        FROM public.dap_periodo
        WHERE dap_id = $1
        ORDER BY ordem
      `;
      const periodosResult = await pool.query(periodosSql, [id]);
      const periodoIds = periodosResult.rows.map((row) => row.id);

      let atos = [];
      if (periodoIds.length) {
        const atosSql = `
          SELECT periodo_id AS "periodoId", codigo, tributacao, quantidade, tfj_valor AS "tfjValor"
          FROM public.dap_periodo_ato_snapshot
          WHERE periodo_id = ANY($1)
          ORDER BY codigo, tributacao
        `;
        const atosResult = await pool.query(atosSql, [periodoIds]);
        atos = atosResult.rows;
      }

      const periodoMap = periodosResult.rows.map((periodo) => ({
        ...periodo,
        atos: atos.filter((ato) => ato.periodoId === periodo.id),
      }));

      return res.json({
        ...headerResult.rows[0],
        periodos: periodoMap,
      });
    } catch (error) {
      console.error('Erro ao obter DAP:', error);
      return res.status(500).json({ error: 'Erro ao obter DAP.' });
    }
  });

  app.post('/api/dap/:id/retificar', ensureAuth, async (req, res) => {
    try {
      const originalId = Number(req.params.id);
      if (!Number.isInteger(originalId)) {
        return res.status(400).json({ error: 'ID inválido.' });
      }

      const payload = req.body || {};
      payload.retificadora = true;
      payload.retificadoraDeId = originalId;

      const result = await withTransaction(pool, async (client) => {
        const original = await client.query('SELECT id FROM public.dap WHERE id = $1', [originalId]);
        if (!original.rowCount) {
          throw new Error('DAP original não encontrada.');
        }
        return persistDap(client, payload);
      });

      return res.status(201).json({ id: result.dapId });
    } catch (error) {
      console.error('Erro ao criar DAP retificadora:', error);
      return res.status(500).json({ error: error.message || 'Erro ao criar DAP retificadora.' });
    }
  });

  app.delete('/api/dap/:id', ensureAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'ID inválido.' });
      }

      const deleted = await pool.query('DELETE FROM public.dap WHERE id = $1 RETURNING id', [id]);
      if (!deleted.rowCount) {
        return res.status(404).json({ error: 'DAP não encontrada.' });
      }
      return res.json({ ok: true, id });
    } catch (error) {
      console.error('Erro ao excluir DAP:', error);
      return res.status(500).json({ error: 'Erro ao excluir DAP.' });
    }
  });
};
