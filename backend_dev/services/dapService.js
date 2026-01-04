const pool = require('../db');
const { parseDapPdf } = require('./dapParser');

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

function mapHeaderPayload(raw = {}) {
  const ano = Number(raw.ano) || null;
  const mes = Number(raw.mes) || null;
  if (!ano || ano < 1900 || ano > 9999) throw createValidationError('Campo ano é obrigatório e deve ser numérico.');
  if (!mes || mes < 1 || mes > 12) throw createValidationError('Campo mes é obrigatório (1-12).');
  const tipo = normalizeTipo(raw.tipo || 'ORIGINAL');
  const status = normalizeStatus(raw.status || 'ATIVA');
  const numero = raw.numero ? String(raw.numero).trim() : null;
  const dataEmissao = normalizeDate(raw.dataEmissao || raw.data_emissao);
  const serventiaId = raw.serventia_id ? Number(raw.serventia_id) : null;
  const metadata = raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {};

  return {
    ano,
    mes,
    numero,
    tipo,
    data_emissao: dataEmissao,
    serventia_id: serventiaId,
    status,
    metadata,
    retificada_por_id: raw.retificada_por_id ? Number(raw.retificada_por_id) : null,
    retificadora_de_id: raw.retificadora_de_id ? Number(raw.retificadora_de_id) : null,
  };
}

function normalizeTipo(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === 'RETIFICADORA' ? 'RETIFICADORA' : 'ORIGINAL';
}

function normalizeStatus(value) {
  const normalized = String(value || '').trim().toUpperCase();
  const allowed = ['ATIVA', 'RETIFICADA', 'RETIFICADORA', 'REMOVIDA'];
  return allowed.includes(normalized) ? normalized : 'ATIVA';
}

function normalizeDate(input) {
  if (!input) return null;
  if (input instanceof Date) {
    return input.toISOString().slice(0, 10);
  }
  const str = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const br = str.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  throw createValidationError('Data inválida. Use YYYY-MM-DD.');
}

function mapPeriodPayload(raw = {}) {
  const periodoNumero = Number(raw.periodo_numero ?? raw.numero ?? raw.periodo ?? raw.periodoNumero);
  if (!periodoNumero || periodoNumero < 1 || periodoNumero > 4) {
    throw createValidationError('periodo_numero deve estar entre 1 e 4.');
  }
  return {
    periodo_numero: periodoNumero,
    total_atos: toNumber(raw.total_atos ?? raw.totalAtos),
    total_emolumentos: toNumber(raw.total_emolumentos ?? raw.totalEmolumentos),
    total_ted: toNumber(raw.total_ted ?? raw.totalTed),
    total_iss: toNumber(raw.total_iss ?? raw.totalIss),
    total_liquido: toNumber(raw.total_liquido ?? raw.totalLiquido),
    outros_campos: raw.outros_campos && typeof raw.outros_campos === 'object' ? raw.outros_campos : (raw.outrosCampos && typeof raw.outrosCampos === 'object' ? raw.outrosCampos : {}),
    atos: Array.isArray(raw.atos) ? raw.atos.map(mapAtoPayload) : [],
  };
}

function mapAtoPayload(raw = {}) {
  return {
    codigo_ato: raw.codigo_ato || raw.codigoAto || null,
    descricao: raw.descricao || null,
    quantidade: toInteger(raw.quantidade),
    emolumentos: toNumber(raw.emolumentos),
    taxa_iss: toNumber(raw.taxa_iss ?? raw.taxaIss),
    taxa_cns: toNumber(raw.taxa_cns ?? raw.taxaCns),
    valor_liquido: toNumber(raw.valor_liquido ?? raw.valorLiquido),
    detalhes: raw.detalhes && typeof raw.detalhes === 'object' ? raw.detalhes : null,
  };
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return value;
  const normalized = String(value).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInteger(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Math.trunc(value);
  const parsed = parseInt(String(value).replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function createValidationError(message) {
  const err = new Error(message);
  err.name = 'ValidationError';
  return err;
}

async function insertCabecalho(client, header, metadata) {
  const mergedMetadata = { ...metadata, ...header.metadata };
  const { rows } = await client.query(
    `INSERT INTO dap_cabecalho (ano, mes, numero, tipo, data_emissao, serventia_id, status, retificada_por_id, retificadora_de_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      header.ano,
      header.mes,
      header.numero,
      header.tipo,
      header.data_emissao,
      header.serventia_id,
      header.status,
      header.retificada_por_id,
      header.retificadora_de_id,
      mergedMetadata,
    ]
  );
  return rows[0];
}

async function insertPeriodos(client, dapId, periodos) {
  const inserted = [];
  for (const periodo of periodos) {
    const { rows } = await client.query(
      `INSERT INTO dap_periodos (dap_id, periodo_numero, total_atos, total_emolumentos, total_ted, total_iss, total_liquido, outros_campos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        dapId,
        periodo.periodo_numero,
        periodo.total_atos,
        periodo.total_emolumentos,
        periodo.total_ted,
        periodo.total_iss,
        periodo.total_liquido,
        periodo.outros_campos || {},
      ]
    );
    const periodoRow = rows[0];
    inserted.push(periodoRow);
    if (Array.isArray(periodo.atos) && periodo.atos.length) {
      await insertAtos(client, periodoRow.id, periodo.atos);
    }
  }
  return inserted;
}

async function insertAtos(client, periodoId, atos) {
  for (const ato of atos) {
    await client.query(
      `INSERT INTO dap_atos (dap_periodo_id, codigo_ato, descricao, quantidade, emolumentos, taxa_iss, taxa_cns, valor_liquido, detalhes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        periodoId,
        ato.codigo_ato,
        ato.descricao,
        ato.quantidade,
        ato.emolumentos,
        ato.taxa_iss,
        ato.taxa_cns,
        ato.valor_liquido,
        ato.detalhes || null,
      ]
    );
  }
}

async function findExistingByCompetencia(client, header) {
  const { rows } = await client.query(
    'SELECT * FROM dap_cabecalho WHERE ano = $1 AND mes = $2 AND tipo = $3 LIMIT 1',
    [header.ano, header.mes, header.tipo]
  );
  return rows[0] || null;
}

async function ensureNotDuplicate(client, header) {
  const existing = await findExistingByCompetencia(client, header);
  if (!existing) return null;

  const err = createValidationError('Já existe uma DAP cadastrada para esta competência e tipo.');
  err.statusCode = 409;
  err.details = { existingId: existing.id };
  throw err;
}

async function deletePeriodosEAtos(client, dapId) {
  await client.query('DELETE FROM dap_atos WHERE dap_periodo_id IN (SELECT id FROM dap_periodos WHERE dap_id = $1)', [dapId]);
  await client.query('DELETE FROM dap_periodos WHERE dap_id = $1', [dapId]);
}

function mergeMetadataForPersistence(metadataExtra, headerMetadata) {
  const base = metadataExtra && typeof metadataExtra === 'object' ? metadataExtra : {};
  const headerMeta = headerMetadata && typeof headerMetadata === 'object' ? headerMetadata : {};
  return { ...base, ...headerMeta };
}

async function updateCabecalho(client, existingRow, header, metadataExtra, options = {}) {
  const mergedMetadata = mergeMetadataForPersistence(metadataExtra, header.metadata);
  const shouldPreserveStatus = options.preserveStatusWhenActive !== false;
  const statusFromHeader = header.status;
  const status = shouldPreserveStatus && existingRow.status && existingRow.status !== 'ATIVA' && statusFromHeader === 'ATIVA'
    ? existingRow.status
    : statusFromHeader || existingRow.status;

  const retificadaPorId = header.retificada_por_id !== undefined && header.retificada_por_id !== null
    ? header.retificada_por_id
    : existingRow.retificada_por_id;
  const retificadoraDeId = header.retificadora_de_id !== undefined && header.retificadora_de_id !== null
    ? header.retificadora_de_id
    : existingRow.retificadora_de_id;

  const { rows } = await client.query(
    `UPDATE dap_cabecalho
       SET numero = $1,
           tipo = $2,
           data_emissao = $3,
           serventia_id = $4,
           status = $5,
           retificada_por_id = $6,
           retificadora_de_id = $7,
           metadata = $8,
           atualizado_em = NOW()
     WHERE id = $9
     RETURNING *`,
    [
      header.numero,
      header.tipo,
      header.data_emissao,
      header.serventia_id,
      status,
      retificadaPorId,
      retificadoraDeId,
      mergedMetadata,
      existingRow.id,
    ]
  );
  return rows[0];
}

async function linkRetificadora(client, cabecalhoRow) {
  if (cabecalhoRow.tipo !== 'RETIFICADORA') {
    return cabecalhoRow;
  }
  const { ano, mes } = cabecalhoRow;
  const { rows } = await client.query(
    `SELECT id, status FROM dap_cabecalho WHERE ano = $1 AND mes = $2 AND tipo = 'ORIGINAL' ORDER BY atualizado_em DESC LIMIT 1`,
    [ano, mes]
  );
  if (!rows.length) {
    return cabecalhoRow;
  }
  const original = rows[0];
  await client.query(
    `UPDATE dap_cabecalho SET retificada_por_id = $1, status = 'RETIFICADA', atualizado_em = NOW() WHERE id = $2`,
    [cabecalhoRow.id, original.id]
  );
  await client.query(
    `UPDATE dap_cabecalho SET retificadora_de_id = $1, atualizado_em = NOW() WHERE id = $2`,
    [original.id, cabecalhoRow.id]
  );
  cabecalhoRow.retificadora_de_id = original.id;
  return cabecalhoRow;
}

async function createDapFromStructured(payload, options = {}) {
  const headerInput = mapHeaderPayload(payload.cabecalho || payload.header || {});
  const periodosInput = Array.isArray(payload.periodos) ? payload.periodos.map(mapPeriodPayload) : [];
  const metadataExtra = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
  return withTransaction(async (client) => {
  await ensureNotDuplicate(client, headerInput);
    const cabecalhoRow = await insertCabecalho(client, headerInput, metadataExtra);
    const periodosRows = await insertPeriodos(client, cabecalhoRow.id, periodosInput);
    const linkedCabecalho = await linkRetificadora(client, cabecalhoRow);
    return {
      cabecalho: linkedCabecalho,
      periodos: await fetchPeriodosWithAtos(client, cabecalhoRow.id, periodosRows),
    };
  });
}

async function fetchPeriodosWithAtos(client, dapId, knownPeriodos) {
  const periodos = knownPeriodos || (await client.query('SELECT * FROM dap_periodos WHERE dap_id = $1 ORDER BY periodo_numero', [dapId])).rows;
  const periodosWithAtos = [];
  for (const periodo of periodos) {
    const { rows: atos } = await client.query('SELECT * FROM dap_atos WHERE dap_periodo_id = $1 ORDER BY id', [periodo.id]);
    periodosWithAtos.push({ ...periodo, atos });
  }
  return periodosWithAtos;
}

function buildTextPreview(input, maxChars = 800) {
  try {
    let text = null;
    // If caller passed the already-extracted text, use it directly.
    if (typeof input === 'string') {
      text = input;
    } else if (input && typeof input.subarray === 'function') {
      // Buffer fallback: try to decode a prefix as utf8
      const slice = input.subarray(0, Math.min(input.length, maxChars * 4));
      text = slice.toString('utf8');
    } else {
      return null;
    }
    if (!text) return null;
    // Remove non-printable/control characters that break logs or responses,
    // keep basic latin, whitespace and common latin-1 punctuation.
    const cleaned = text.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, ' ');
    const compact = cleaned.replace(/\s+/g, ' ').trim();
    return compact.slice(0, maxChars);
  } catch (_) {
    return null;
  }
}

async function createDapFromPdf(buffer, options = {}) {
  let parsed;
  try {
    parsed = await parseDapPdf(buffer);
  } catch (err) {
    // Prefer any extracted text attached by the parser (more readable).
    const preview = err && err.extractedText ? buildTextPreview(err.extractedText, 800) : buildTextPreview(buffer, 800);
    if (preview) {
      try { console.error('[dap][parse] falha parse PDF; preview:', preview); } catch (_) {}
    }
    if (!err.preview && preview) {
      err.preview = preview;
    }
    throw err;
  }
  const metadata = { origem: 'pdf-upload' };
  const fallbackPreview = !parsed.metadata || !parsed.metadata.rawTextLength ? buildTextPreview(buffer, 200) : null;
  if (fallbackPreview) metadata.preview = fallbackPreview;

  const payload = {
    cabecalho: {
      ano: parsed.header.ano,
      mes: parsed.header.mes,
      numero: parsed.header.numero,
      tipo: parsed.header.tipo,
      dataEmissao: parsed.header.dataEmissao,
      metadata: { ...parsed.metadata, bruto: { serventia: parsed.header.serventia } },
    },
    periodos: parsed.periods || parsed.periodos || [],
    metadata,
  };
  const sourcePeriods = Array.isArray(parsed.periods) ? parsed.periods : Array.isArray(parsed.periodos) ? parsed.periodos : [];
  if (sourcePeriods.length) {
    payload.periodos = sourcePeriods.map((periodo) => ({
      periodoNumero: periodo.numero,
      totalAtos: periodo.totalAtos,
      totalEmolumentos: periodo.totalEmolumentos,
      totalTed: periodo.totalTed,
      totalIss: periodo.totalIss,
      totalLiquido: periodo.totalLiquido,
      outrosCampos: periodo.outrosCampos,
      atos: periodo.atos,
    }));
  }
  return createDapFromStructured(payload, options);
}

async function listDaps(filters = {}, pagination = {}) {
  const conds = [];
  const params = [];
  if (filters.ano) { params.push(Number(filters.ano)); conds.push(`ano = $${params.length}`); }
  if (filters.mes) { params.push(Number(filters.mes)); conds.push(`mes = $${params.length}`); }
  if (filters.tipo) { params.push(normalizeTipo(filters.tipo)); conds.push(`tipo = $${params.length}`); }
  if (filters.status) { params.push(normalizeStatus(filters.status)); conds.push(`status = $${params.length}`); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const page = Math.max(1, Number(pagination.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(pagination.pageSize) || 20));
  const offset = (page - 1) * pageSize;
  const baseQuery = `SELECT * FROM dap_cabecalho ${where} ORDER BY ano DESC, mes DESC, id DESC LIMIT ${pageSize} OFFSET ${offset}`;
  const { rows } = await pool.query(baseQuery, params);
  return {
    page,
    pageSize,
    registros: rows,
  };
}

async function getDapById(id) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM dap_cabecalho WHERE id = $1', [id]);
    if (!rows.length) return null;
    const cabecalho = rows[0];
    const periodos = await fetchPeriodosWithAtos(client, id);
    return { cabecalho, periodos };
  } finally {
    client.release();
  }
}

async function updateDap(id, payload = {}) {
  const headerUpdates = {};
  if (payload.numero !== undefined) headerUpdates.numero = payload.numero ? String(payload.numero).trim() : null;
  if (payload.dataEmissao !== undefined || payload.data_emissao !== undefined) headerUpdates.data_emissao = normalizeDate(payload.dataEmissao ?? payload.data_emissao);
  if (payload.status !== undefined) headerUpdates.status = normalizeStatus(payload.status);
  if (payload.metadata && typeof payload.metadata === 'object') headerUpdates.metadata = payload.metadata;
  if (payload.retificada_por_id !== undefined) headerUpdates.retificada_por_id = payload.retificada_por_id;
  if (payload.retificadora_de_id !== undefined) headerUpdates.retificadora_de_id = payload.retificadora_de_id;

  const fields = Object.keys(headerUpdates);
  if (!fields.length) {
    return getDapById(id);
  }

  const assignments = fields.map((field, idx) => `${field} = $${idx + 1}`);
  const values = fields.map((field) => headerUpdates[field]);
  values.push(id);

  await pool.query(
    `UPDATE dap_cabecalho SET ${assignments.join(', ')}, atualizado_em = NOW() WHERE id = $${fields.length + 1}`,
    values
  );

  if (headerUpdates.status === 'REMOVIDA') {
    await pool.query('UPDATE dap_cabecalho SET status = $1, atualizado_em = NOW() WHERE retificadora_de_id = $2', ['RETIFICADA', id]);
  }

  if (headerUpdates.retificadora_de_id) {
    await pool.query('UPDATE dap_cabecalho SET retificada_por_id = $1, status = $2, atualizado_em = NOW() WHERE id = $3', [id, 'RETIFICADA', headerUpdates.retificadora_de_id]);
  }

  return getDapById(id);
}

async function softDeleteDap(id) {
  await pool.query('UPDATE dap_cabecalho SET status = $1, atualizado_em = NOW() WHERE id = $2', ['REMOVIDA', id]);
  return getDapById(id);
}

module.exports = {
  createDapFromPdf,
  createDapFromStructured,
  listDaps,
  getDapById,
  updateDap,
  softDeleteDap,
  parseDapPdf,
};
