// routes/dap.js
// Rotas da Declaração de Apuração (DAP)
// Uso no server: const initDapRoutes = require('./routes/dap'); initDapRoutes(app, pool, { ensureAuth, parseDapPdf });

const multer = require('multer');
const pool = require('../db');
const { ensureAuth } = require('../middlewares/auth');
const { parseDapPdf } = require('../services/dapParser');

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

async function withTransaction(poolArg, handler) {
  const client = await poolArg.connect();
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
  // Se vier um array plano de atos, cria um único período com todos os atos, sem alterar nada
  if (Array.isArray(rawPeriodos) && rawPeriodos.length > 0 && !rawPeriodos[0].atos) {
    console.log('[normalizePeriodos] Recebidos', rawPeriodos.length, 'atos');
    // Apenas repassa todos os atos, sem nenhum tipo de transformação
    return [{
      ordem: 1,
      quantidade_total: rawPeriodos.reduce((sum, ato) => sum + (ato.quantidade || 0), 0),
      tfj_total: rawPeriodos.reduce((sum, ato) => sum + (ato.tfj_valor || 0), 0),
      atos: rawPeriodos
    }];
  }

  // Caso padrão: array de períodos, cada um com array de atos
  if (Array.isArray(rawPeriodos) && rawPeriodos.length > 0 && Array.isArray(rawPeriodos[0].atos)) {
    // Apenas repassa todos os períodos e seus atos, sem transformação
    return rawPeriodos.map((periodo) => ({
      ordem: periodo.ordem ?? periodo.periodo ?? periodo.ordem_periodo ?? periodo.numero ?? 1,
      quantidade_total: Array.isArray(periodo.atos) ? periodo.atos.reduce((sum, ato) => sum + (ato.quantidade || 0), 0) : 0,
      tfj_total: Array.isArray(periodo.atos) ? periodo.atos.reduce((sum, ato) => sum + (ato.tfj_valor || 0), 0) : 0,
      atos: Array.isArray(periodo.atos) ? periodo.atos : []
    }));
  }

  // Se não houver atos, retorna período vazio
  return [{ ordem: 1, quantidade_total: 0, tfj_total: 0, atos: [] }];
}

async function persistDap(client, payload) {
  const header = normalizeHeader(payload.header ?? payload);
  if (payload.retificadora === true || payload.retificadora === 'true') {
    header.retificadora = true;
  }
  if (payload.retificadoraDeId) {
    header.retificadora_de_id = payload.retificadoraDeId;
  }

  // LOG: quantidade de atos recebidos no payload
  let totalAtos = 0;
  if (Array.isArray(payload.periodosDap)) {
    if (payload.periodosDap.length > 0 && Array.isArray(payload.periodosDap[0].atos)) {
      totalAtos = payload.periodosDap.reduce((acc, p) => acc + (Array.isArray(p.atos) ? p.atos.length : 0), 0);
    } else {
      totalAtos = payload.periodosDap.length;
    }
  } else if (Array.isArray(payload.periodos)) {
    if (payload.periodos.length > 0 && Array.isArray(payload.periodos[0].atos)) {
      totalAtos = payload.periodos.reduce((acc, p) => acc + (Array.isArray(p.atos) ? p.atos.length : 0), 0);
    } else {
      totalAtos = payload.periodos.length;
    }
  }
  console.log(`==== [persistDap] Atos recebidos no payload: ${totalAtos}`);

  const insertColumns = [
    'mes_referencia', 'ano_referencia', 'retificadora', 'retificadora_de_id',
    'serventia_nome', 'codigo_serventia', 'cnpj', 'data_transmissao', 'codigo_recibo', 'observacoes',
    'emolumento_apurado', 'taxa_fiscalizacao_judiciaria_apurada', 'taxa_fiscalizacao_judiciaria_paga',
    'recompe_apurado', 'recompe_depositado', 'data_deposito_recompe',
    'valores_recebidos_recompe', 'valores_recebidos_ferrfis', 'issqn_recebido_usuarios',
    'repasses_responsaveis_anteriores', 'saldo_deposito_previo', 'total_despesas_mes',
    'estoque_selos_eletronicos_transmissao',
  ];

  const insertValues = insertColumns.map((col) => header[col] ?? null);
  const placeholders = insertColumns.map((_, index) => `$${index + 1}`);

  const dapResult = await client.query(
    `INSERT INTO public.dap (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
    insertValues,
  );
  const dapId = dapResult.rows[0].id;

  // Log the final serventia name that will be persisted (helpful for debugging)
  try {
    console.log(`==== [persistDap] Serventia a ser salva: ${header.serventia_nome}`);
  } catch (e) {
    // ignore logging errors
  }

  if (header.retificadora_de_id) {
    await client.query('UPDATE public.dap SET retificada_por_id = $1 WHERE id = $2', [dapId, header.retificadora_de_id]);
  }

  const periodos = normalizePeriodos(payload.periodos || payload.periodosDap || []);
  const periodoIdMap = new Map();

  console.log('==== PERSISTINDO PERÍODOS E ATOS ====');
  console.log(`Total de períodos a persistir: ${periodos.length}`);

  for (const periodo of periodos) {
    console.log(`\nPersistindo período ${periodo.ordem}: ${periodo.atos.length} atos`);
    
    const periodoInsert = await client.query(
      'INSERT INTO public.dap_periodo (dap_id, ordem, quantidade_total, tfj_total) VALUES ($1, $2, $3, $4) RETURNING id',
      [dapId, periodo.ordem, periodo.quantidade_total, periodo.tfj_total],
    );
    const periodoId = periodoInsert.rows[0].id;
    periodoIdMap.set(periodo.ordem, periodoId);
    console.log(`  → periodo_id criado: ${periodoId}`);

    for (const ato of periodo.atos) {
      // Per-ato insertion logs are verbose; enable via env var DEBUG_DAP_PARSER
      if (process.env.DEBUG_DAP_PARSER === 'true') {
        console.log(`    Inserindo ato: codigo=${ato.codigo}, trib=${ato.tributacao}, qtd=${ato.quantidade}, tfj=${ato.tfj_valor}`);
      }
      await client.query(
        `INSERT INTO public.dap_periodo_ato_snapshot (periodo_id, codigo, tributacao, quantidade, tfj_valor)
         VALUES ($1, $2, $3, $4, $5)`,
        [periodoId, ato.codigo, ato.tributacao, ato.quantidade, ato.tfj_valor],
      );
    }
    console.log(`  ✓ ${periodo.atos.length} atos inseridos`);
  }
  console.log('==== FIM PERSISTÊNCIA ====\n');

  return { dapId, periodos: Array.from(periodoIdMap.entries()).map(([ordem, id]) => ({ ordem, id })) };
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


const HISTORICO_CATEGORIES = [
  { id: 'nascimentosProprios', label: 'Registros de Nascimento Próprios (9101, trib 26)', code: '9101', trib: 26 },
  { id: 'nascimentosUI', label: 'Registros de Nascimento UI (9101, trib 29)', code: '9101', trib: 29 },
  { id: 'obitosProprios', label: 'Registros de Óbito Próprios (9201, trib 26)', code: '9201', trib: 26 },
  { id: 'obitosUI', label: 'Registros de Óbito UI (9201, trib 29)', code: '9201', trib: 29 },
];

function padMonthValue(value) {
  return String(value).padStart(2, '0');
}

function buildMonthKey(year, month) {
  return `${year}-${padMonthValue(month)}`;
}

function getLast12Months() {
  const today = new Date();
  const months = [];
  for (let offset = 11; offset >= 0; offset -= 1) {
    const cursor = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    months.push({
      year,
      month,
      key: buildMonthKey(year, month),
      label: `${padMonthValue(month)}/${year}`,
    });
  }
  return months;
}

module.exports = function initDapRoutes(appArg = null, poolArg = null, options = {}) {
  const app = appArg || require('express')();
  const db = poolArg || pool;
  const guard = options.ensureAuth || ensureAuth;
  const uploadMiddleware = upload.single('file');
  const parsePdf = options.parseDapPdf || parseDapPdf;
  const enforceServentia = options.enforceServentia || ((req) => {
    const user = req.user || {};
    const candidates = [
      user.codigo_serventia,
      user.codigoServentia,
      user.serventia_codigo,
      user.serventiaCodigo,
      user.serventia_id,
      user.serventiaId,
      user.serventia,
      req.query?.codigoServentia,
      req.query?.serventia,
      req.body?.codigoServentia,
    ].filter((v) => v !== undefined && v !== null && String(v).trim() !== '');

    if (!candidates.length) {
      const err = new Error('Serventia do usuário não encontrada.');
      err.status = 400;
      throw err;
    }

    return String(candidates[0]);
  });

  // Upload + parsing de PDF
  app.post('/api/dap/upload', guard, uploadMiddleware, async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Arquivo da DAP é obrigatório.' });
      if (!parsePdf) return res.status(501).json({ error: 'Parser de DAP não configurado.' });


      const metadata = req.body && req.body.metadata ? JSON.parse(req.body.metadata) : {};
      const parsed = await parsePdf({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        metadata,
      });

      // LOG EXTRA: Inspecionar periodosDap do parser antes de normalizar
      console.log('==== DEBUG: periodosDap do parser (antes de normalizePeriodos) ====');
      if (parsed.periodosDap && parsed.periodosDap.length > 0 && Array.isArray(parsed.periodosDap[0].atos)) {
        console.log('periodosDap[0].atos.length:', parsed.periodosDap[0].atos.length);
      } else {
        console.log('periodosDap:', Array.isArray(parsed.periodosDap) ? parsed.periodosDap.length : 0);
      }

      // LOG DETALHADO: Após extração do parser
      let atosExtraidos = [];
      if (Array.isArray(parsed.periodosDap)) {
        if (parsed.periodosDap.length > 0 && Array.isArray(parsed.periodosDap[0].atos)) {
          atosExtraidos = parsed.periodosDap.flatMap(p => Array.isArray(p.atos) ? p.atos : []);
        } else {
          atosExtraidos = parsed.periodosDap;
        }
      } else if (Array.isArray(parsed.periodos)) {
        if (parsed.periodos.length > 0 && Array.isArray(parsed.periodos[0].atos)) {
          atosExtraidos = parsed.periodos.flatMap(p => Array.isArray(p.atos) ? p.atos : []);
        } else {
          atosExtraidos = parsed.periodos;
        }
      }
      console.log(`==== [dap.js] [DEBUG] Atos extraídos do parser: ${atosExtraidos.length}`);


      // LOG: Antes do mapeamento para DB
      let periodosParaDb;
      if (parsed.periodosDap && parsed.periodosDap.length === 1 && Array.isArray(parsed.periodosDap[0].atos)) {
        // Se só há um período, passar o array de atos diretamente para normalizar como período único
        periodosParaDb = normalizePeriodos(parsed.periodosDap[0].atos);
      } else {
        periodosParaDb = normalizePeriodos(parsed.periodos || parsed.periodosDap || []);
      }
      let totalAtosParaDb = periodosParaDb.reduce((acc, p) => acc + (Array.isArray(p.atos) ? p.atos.length : 0), 0);
      console.log(`==== [dap.js] Atos após normalizePeriodos: ${totalAtosParaDb}`);
      if (periodosParaDb.length > 0 && Array.isArray(periodosParaDb[0].atos) && periodosParaDb[0].atos.length > 0) {
        console.log('[dap.js] Exemplo de ato mapeado para DB:', JSON.stringify(periodosParaDb[0].atos[0], null, 2));
      }

      // LOG EXTRA: Antes de persistir, mostrar quantidade de atos e códigos dos primeiros 10
      if (periodosParaDb.length > 0 && Array.isArray(periodosParaDb[0].atos)) {
        const todosAtos = periodosParaDb.flatMap(p => Array.isArray(p.atos) ? p.atos : []);
        console.log('==== [dap.js] [DEBUG] Atos prontos para persistir:', todosAtos.length);
      }
      const result = await withTransaction(db, (client) => persistDap(client, parsed));
      return res.status(201).json({ id: result.dapId, status: 'processed' });
    } catch (error) {
      console.error('Erro no upload de DAP:', error);
      if (error && error.name === 'DapParseError') {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Erro ao processar DAP.' });
    }
  });

  // Criação manual (para reprocessamentos)
  app.post('/api/dap', guard, async (req, res) => {
    try {
      const payload = req.body || {};
      const result = await withTransaction(db, (client) => persistDap(client, payload));
      return res.status(201).json({ id: result.dapId });
    } catch (error) {
      console.error('Erro ao criar DAP:', error);
      return res.status(500).json({ error: error.message || 'Erro ao criar DAP.' });
    }
  });

  // Listagem
  app.get('/api/dap', guard, async (req, res) => {
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
      const { rows } = await db.query(sql, params);
      return res.json(rows);
    } catch (error) {
      console.error('Erro ao listar DAPs:', error);
      return res.status(500).json({ error: 'Erro ao listar DAPs.' });
    }
  });

  // Detalhe
  app.get('/api/dap/:id', guard, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido.' });

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
      const headerResult = await db.query(headerSql, [id]);
      if (!headerResult.rowCount) return res.status(404).json({ error: 'DAP não encontrada.' });

      const periodosSql = `
        SELECT id, ordem, quantidade_total AS "quantidadeTotal", tfj_total AS "tfjTotal"
        FROM public.dap_periodo
        WHERE dap_id = $1
        ORDER BY ordem
      `;
      const periodosResult = await db.query(periodosSql, [id]);
      const periodoIds = periodosResult.rows.map((row) => row.id);

      let atos = [];
      if (periodoIds.length) {
        const atosSql = `
          SELECT periodo_id AS "periodoId", codigo, tributacao, quantidade, tfj_valor AS "tfjValor"
          FROM public.dap_periodo_ato_snapshot
          WHERE periodo_id = ANY($1)
          ORDER BY codigo, tributacao
        `;
        const atosResult = await db.query(atosSql, [periodoIds]);
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

  // Retificação
  app.post('/api/dap/:id/retificar', guard, async (req, res) => {
    try {
      const originalId = Number(req.params.id);
      if (!Number.isInteger(originalId)) return res.status(400).json({ error: 'ID inválido.' });

      const payload = req.body || {};
      payload.retificadora = true;
      payload.retificadoraDeId = originalId;

      const result = await withTransaction(db, async (client) => {
        const original = await client.query('SELECT id FROM public.dap WHERE id = $1', [originalId]);
        if (!original.rowCount) throw new Error('DAP original não encontrada.');
        return persistDap(client, payload);
      });

      return res.status(201).json({ id: result.dapId });
    } catch (error) {
      console.error('Erro ao criar DAP retificadora:', error);
      return res.status(500).json({ error: error.message || 'Erro ao criar DAP retificadora.' });
    }
  });
// grafico 12 meses nacimento e obito
  app.get('/api/dap/historico-nas-ob', guard, async (req, res) => {
    try {
      const codigoServentia = enforceServentia(req);
      const months = getLast12Months();
      const monthThreshold = Math.min(...months.map((month) => month.year * 100 + month.month));
      const codes = Array.from(new Set(HISTORICO_CATEGORIES.map((category) => category.code)));
      const tribs = Array.from(new Set(HISTORICO_CATEGORIES.map((category) => category.trib)));

      const sql = `
        SELECT d.ano_referencia AS ano, d.mes_referencia AS mes,
               ato.codigo, CAST(NULLIF(ato.tributacao, '') AS INTEGER) AS tributacao,
               SUM(ato.quantidade) AS quantidade
        FROM public.dap d
        JOIN public.dap_periodo dp ON dp.dap_id = d.id
        JOIN public.dap_periodo_ato_snapshot ato ON ato.periodo_id = dp.id
        WHERE d.codigo_serventia = $1
          AND (d.ano_referencia * 100 + d.mes_referencia) >= $2
          AND ato.codigo = ANY($3)
          AND CAST(NULLIF(ato.tributacao, '') AS INTEGER) = ANY($4)
        GROUP BY d.ano_referencia, d.mes_referencia, ato.codigo, CAST(NULLIF(ato.tributacao, '') AS INTEGER)
      `;
      const { rows } = await db.query(sql, [codigoServentia, monthThreshold, codes, tribs]);

      const monthMap = new Map();
      months.forEach((month) => {
        monthMap.set(month.key, {
          ...month,
          totals: HISTORICO_CATEGORIES.reduce((acc, category) => ({
            ...acc,
            [category.id]: 0,
          }), {}),
        });
      });

      rows.forEach((row) => {
        const key = buildMonthKey(row.ano, row.mes);
        const entry = monthMap.get(key);
        if (!entry) return;
        const category = HISTORICO_CATEGORIES.find((cat) => cat.code === row.codigo && cat.trib === row.tributacao);
        if (!category) return;
        entry.totals[category.id] += Number(row.quantidade) || 0;
      });

      const responseMonths = months.map((month) => {
        const entry = monthMap.get(month.key);
        return {
          key: month.key,
          label: month.label,
          year: month.year,
          month: month.month,
          totals: entry ? { ...entry.totals } : HISTORICO_CATEGORIES.reduce((acc, category) => ({ ...acc, [category.id]: 0 }), {}),
        };
      });

      return res.json({ months: responseMonths });
    } catch (error) {
      console.error('Erro ao gerar histórico Nas/OB:', error);
      const status = error.status && Number.isInteger(error.status) ? error.status : 500;
      const message = error.message || 'Erro ao carregar o histórico de registros.';
      return res.status(status).json({ error: message });
    }
  });

  // Exclusão
  app.delete('/api/dap/:id', guard, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido.' });

      const deleted = await db.query('DELETE FROM public.dap WHERE id = $1 RETURNING id', [id]);
      if (!deleted.rowCount) return res.status(404).json({ error: 'DAP não encontrada.' });
      return res.json({ ok: true, id });
    } catch (error) {
      console.error('Erro ao excluir DAP:', error);
      return res.status(500).json({ error: 'Erro ao excluir DAP.' });
    }
  });

  return app;
};
